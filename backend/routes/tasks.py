from flask import Blueprint, request, jsonify
from database.mongodb import tasks_collection, task_evidence_collection, users_collection, projects_collection
from bson import ObjectId
from datetime import datetime
import os
from utils.serializer import serialize_doc

tasks_bp = Blueprint("tasks", __name__)

def get_caller_user():
    caller_id = request.headers.get("X-User-Id")
    if not caller_id:
        return None
    try:
        if ObjectId.is_valid(caller_id):
            user = users_collection.find_one({"_id": ObjectId(caller_id)})
            if user:
                user["id"] = str(user["_id"])
                return user
        user = users_collection.find_one({"_id": caller_id})
        if user:
            user["id"] = str(user["_id"])
            return user
    except Exception:
        pass
    return None

def _hydrate_tasks(task_docs, resolve_evidence=False, evidence_user_id=None):
    if not task_docs:
        return []
        
    user_ids = set()
    project_ids = set()
    for task in task_docs:
        if task.get("assigned_to"):
            user_ids.add(str(task["assigned_to"]))
        if task.get("assigned_by"):
            user_ids.add(str(task["assigned_by"]))
        if task.get("project_id"):
            project_ids.add(str(task["project_id"]))
            
    user_query_ids = []
    for uid in user_ids:
        if ObjectId.is_valid(uid):
            user_query_ids.append(ObjectId(uid))
        user_query_ids.append(uid)
        
    project_query_ids = []
    for pid in project_ids:
        if ObjectId.is_valid(pid):
            project_query_ids.append(ObjectId(pid))
        project_query_ids.append(pid)
        
    users_lookup = {}
    if user_query_ids:
        for u in users_collection.find({"_id": {"$in": user_query_ids}}):
            users_lookup[str(u["_id"])] = u.get("name")
            
    projects_lookup = {}
    if project_query_ids:
        for p in projects_collection.find({"_id": {"$in": project_query_ids}}):
            projects_lookup[str(p["_id"])] = p.get("name")
            
    evidence_lookup = {}
    if resolve_evidence:
        task_ids = []
        for t in task_docs:
            tid = t.get("_id")
            if tid:
                task_ids.append(ObjectId(tid) if ObjectId.is_valid(tid) else tid)
        if task_ids:
            ev_query = {"task_id": {"$in": task_ids}}
            if evidence_user_id:
                ev_query["uploaded_by"] = {"$in": [evidence_user_id, ObjectId(evidence_user_id) if ObjectId.is_valid(evidence_user_id) else evidence_user_id]}
            
            # Sort by submitted_at ascending so that the latest evidence overwrites older ones in the dictionary
            for ev in task_evidence_collection.find(ev_query).sort("submitted_at", 1):
                evidence_lookup[str(ev["task_id"])] = ev

    hydrated = []
    for task in task_docs:
        task = serialize_doc(task)
        assigned_to = str(task.get("assigned_to", ""))
        if assigned_to in users_lookup:
            task["assigned_to_name"] = users_lookup[assigned_to]
            
        assigned_by = str(task.get("assigned_by", ""))
        if assigned_by in users_lookup:
            task["assigned_by_name"] = users_lookup[assigned_by]
            
        p_id = str(task.get("project_id", ""))
        if p_id in projects_lookup:
            task["project_name"] = projects_lookup[p_id]
            
        if resolve_evidence:
            task_id_str = str(task["_id"])
            if task_id_str in evidence_lookup:
                task["evidence"] = serialize_doc(evidence_lookup[task_id_str])
                
        hydrated.append(task)
    return hydrated

@tasks_bp.route("/", methods=["GET"])
def get_all_tasks_global():
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    caller_role = caller.get("role", "intern")
    caller_id = caller["id"]
    
    query = {}
    if caller_role == "intern":
        query = {"assigned_to": caller_id}
        if ObjectId.is_valid(caller_id):
            query = {"$or": [{"assigned_to": caller_id}, {"assigned_to": ObjectId(caller_id)}]}
    elif caller_role == "team_lead":
        # Find projects led by this lead
        proj_lead_query = {"lead_id": caller_id}
        if ObjectId.is_valid(caller_id):
            proj_lead_query = {"$or": [{"lead_id": caller_id}, {"lead_id": ObjectId(caller_id)}]}
        led_project_ids = [str(p["_id"]) for p in projects_collection.find(proj_lead_query)]
        
        query = {"project_id": {"$in": led_project_ids}}
        proj_oids = [ObjectId(pid) for pid in led_project_ids if ObjectId.is_valid(pid)]
        if proj_oids:
            query = {"$or": [{"project_id": {"$in": led_project_ids}}, {"project_id": {"$in": proj_oids}}]}
            
    task_docs = list(tasks_collection.find(query))
    tasks = _hydrate_tasks(task_docs)
    return jsonify(tasks)

@tasks_bp.route("/project/<project_id>", methods=["GET"])
def get_project_tasks(project_id):
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    proj_query = {"_id": ObjectId(project_id) if ObjectId.is_valid(project_id) else project_id}
    project = projects_collection.find_one(proj_query)
    if not project:
        return jsonify({"success": False, "message": "Project not found"}), 404
        
    caller_role = caller.get("role", "intern")
    caller_id = caller["id"]
    
    lead_id_str = str(project.get("lead_id", ""))
    member_ids_str = [str(mid) for mid in project.get("member_ids", [])]
    
    # Membership check
    if caller_role == "intern" and caller_id not in member_ids_str:
        return jsonify({"success": False, "message": "Forbidden: You do not belong to this project"}), 403
    
    if caller_role == "team_lead" and caller_id != lead_id_str:
        return jsonify({"success": False, "message": "Forbidden: You are not the Team Lead of this project"}), 403

    query = {"project_id": project_id}
    if ObjectId.is_valid(project_id):
        query = {"$or": [{"project_id": project_id}, {"project_id": ObjectId(project_id)}]}
        
    raw_docs = list(tasks_collection.find(query))
    filtered_docs = []
    for t in raw_docs:
        assigned_to_str = str(t.get("assigned_to", ""))
        if caller_role == "intern" and assigned_to_str != caller_id:
            continue
        filtered_docs.append(t)
        
    tasks = _hydrate_tasks(filtered_docs, resolve_evidence=True)
    return jsonify(tasks)

@tasks_bp.route("/", methods=["POST"])
def create_task():
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    caller_role = caller.get("role", "intern")
    caller_id = caller["id"]
    
    if caller_role != "team_lead":
        return jsonify({"success": False, "message": "Forbidden: Only Team Leads may create tasks"}), 403
        
    data = request.json
    project_id = data.get("project_id")
    
    proj_query = {"_id": ObjectId(project_id) if ObjectId.is_valid(project_id) else project_id}
    project = projects_collection.find_one(proj_query)
    if not project:
        return jsonify({"success": False, "message": "Project not found"}), 404
        
    # Team Lead must lead the project
    if str(project.get("lead_id", "")) != caller_id:
        return jsonify({"success": False, "message": "Forbidden: You do not lead this project"}), 403
        
    # Task assignment validation
    assigned_to = data.get("assigned_to")
    if assigned_to:
        member_ids_str = [str(mid) for mid in project.get("member_ids", [])]
        if str(assigned_to) not in member_ids_str:
            return jsonify({"success": False, "message": "Validation Error: Assignee must be an intern member of the project"}), 400
            
        assigned_user = users_collection.find_one({"_id": ObjectId(assigned_to) if ObjectId.is_valid(assigned_to) else assigned_to})
        if not assigned_user or assigned_user.get("role", "").lower() != "intern":
            return jsonify({"success": False, "message": "Validation Error: Assignee must have the role of Intern"}), 400
            
    task_doc = {
        "project_id": project_id,
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "assigned_to": assigned_to,
        "assigned_by": caller_id,
        "priority": data.get("priority", "Medium"),
        "due_date": data.get("due_date", ""),
        "status": "Pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    result = tasks_collection.insert_one(task_doc)
    try:
        from routes.notifications import create_notification_internal
        create_notification_internal(
            assigned_to,
            "Task Assigned",
            f"You have been assigned a new task: {task_doc['title']}",
            "task_assigned"
        )
    except Exception as e:
        print("Failed to trigger task assignment notification:", e)
        
    return jsonify({
        "success": True,
        "message": "Task created successfully",
        "id": str(result.inserted_id)
    }), 201

@tasks_bp.route("/<task_id>", methods=["PATCH", "PUT"])
def edit_task(task_id):
    if not ObjectId.is_valid(task_id):
        return jsonify({"success": False, "message": "Invalid task ID"}), 400
        
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    caller_role = caller.get("role", "intern")
    caller_id = caller["id"]
    
    task = tasks_collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        return jsonify({"success": False, "message": "Task not found"}), 404
        
    project_id = task.get("project_id")
    proj_query = {"_id": ObjectId(project_id) if ObjectId.is_valid(project_id) else project_id}
    project = projects_collection.find_one(proj_query)
    if not project:
        return jsonify({"success": False, "message": "Project not found for this task"}), 404

    if caller_role == "team_lead":
        if str(project.get("lead_id", "")) != caller_id:
            return jsonify({"success": False, "message": "Forbidden: You do not lead this project"}), 403
    elif caller_role == "intern":
        if str(task.get("assigned_to", "")) != caller_id:
            return jsonify({"success": False, "message": "Forbidden: You cannot modify tasks assigned to others"}), 403
        
        data = request.json
        allowed_keys = ["status"]
        for k in data.keys():
            if k not in allowed_keys:
                return jsonify({"success": False, "message": "Forbidden: Interns may only update task status"}), 403
    else:
        return jsonify({"success": False, "message": "Forbidden: You are not authorized to edit this task"}), 403

    data = request.json
    if "_id" in data:
        del data["_id"]
        
    current_status = task.get("status", "Pending")
    new_status = data.get("status")
    
    if new_status and new_status != current_status:
        if caller_role == "intern":
            if current_status not in ["Pending", "In Progress"] or new_status not in ["Pending", "In Progress"]:
                return jsonify({"success": False, "message": f"Forbidden transition from {current_status} to {new_status} for Intern"}), 400
        elif caller_role == "team_lead":
            if new_status in ["Approved", "Rejected"] and current_status not in ["Under Review", "Completed"]:
                return jsonify({"success": False, "message": f"Cannot mark task as {new_status} unless it is Under Review or Completed (current: {current_status})"}), 400
                
    update_fields = {}
    
    if caller_role == "team_lead":
        assigned_to = data.get("assigned_to")
        if "assigned_to" in data and assigned_to:
            member_ids_str = [str(mid) for mid in project.get("member_ids", [])]
            if str(assigned_to) not in member_ids_str:
                return jsonify({"success": False, "message": "Validation Error: Assignee must belong to the project"}), 400
                
            assigned_user = users_collection.find_one({"_id": ObjectId(assigned_to) if ObjectId.is_valid(assigned_to) else assigned_to})
            if not assigned_user or assigned_user.get("role", "").lower() != "intern":
                return jsonify({"success": False, "message": "Validation Error: Assignee must be an Intern"}), 400
                
        for key in ["title", "description", "assigned_to", "priority", "due_date", "status"]:
            if key in data:
                update_fields[key] = data[key]
    else:
        if "status" in data:
            update_fields["status"] = data["status"]
            
    update_fields["updated_at"] = datetime.utcnow().isoformat()
    
    result = tasks_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_fields}
    )
    
    if "status" in update_fields:
        try:
            from routes.notifications import create_notification_internal
            task = tasks_collection.find_one({"_id": ObjectId(task_id)})
            if task:
                assigned_to = task.get("assigned_to")
                title = task.get("title", "")
                status_val = update_fields["status"]
                create_notification_internal(
                    assigned_to,
                    f"Task Status Updated",
                    f"Your task '{title}' has been set to '{status_val}'",
                    "task_updated"
                )
        except Exception as e:
            print("Failed to trigger task update notification:", e)
            
    return jsonify({"success": True, "message": "Task updated"})

@tasks_bp.route("/<task_id>", methods=["DELETE"])
def delete_task(task_id):
    if not ObjectId.is_valid(task_id):
        return jsonify({"success": False, "message": "Invalid task ID"}), 400
        
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    caller_role = caller.get("role", "intern")
    caller_id = caller["id"]
    
    task = tasks_collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        return jsonify({"success": False, "message": "Task not found"}), 404
        
    project_id = task.get("project_id")
    proj_query = {"_id": ObjectId(project_id) if ObjectId.is_valid(project_id) else project_id}
    project = projects_collection.find_one(proj_query)
    if not project:
        return jsonify({"success": False, "message": "Project not found for this task"}), 404

    if caller_role != "team_lead" or str(project.get("lead_id", "")) != caller_id:
        return jsonify({"success": False, "message": "Forbidden: Only the project's Team Lead may delete tasks"}), 403
        
    result = tasks_collection.delete_one({"_id": ObjectId(task_id)})
    if result.deleted_count == 0:
        return jsonify({"success": False, "message": "Task not found"}), 404
        
    task_evidence_collection.delete_many({"task_id": ObjectId(task_id)})
    return jsonify({"success": True, "message": "Task deleted successfully"})

@tasks_bp.route("/<task_id>/evidence", methods=["POST"])
def upload_evidence(task_id):
    if not ObjectId.is_valid(task_id):
        return jsonify({"success": False, "message": "Invalid task ID"}), 400
        
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    caller_id = caller["id"]
    
    task = tasks_collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        return jsonify({"success": False, "message": "Task not found"}), 404
        
    # Evidence upload allowed only when task.assigned_to == current_user.id
    if str(task.get("assigned_to", "")) != caller_id:
        return jsonify({"success": False, "message": "Forbidden: You are not assigned to this task"}), 403
        
    notes = request.form.get("notes", "")
    
    file_path = ""
    if request.files:
        file = request.files.get("file")
        if file:
            os.makedirs("evidence", exist_ok=True)
            ext = os.path.splitext(file.filename)[1]
            filename = f"task_{task_id}_{int(datetime.utcnow().timestamp())}{ext}"
            file_path_full = os.path.join("evidence", filename)
            file.save(file_path_full)
            file_path = f"evidence/{filename}"
            
    
    evidence_doc = {
        "project_id": task.get("project_id"),
        "task_id": ObjectId(task_id),
        "uploaded_by": caller_id,
        "file_path": file_path,
        "notes": notes,
        "status": "pending",
        "submitted_at": datetime.utcnow().isoformat(),
        "reviewed_by": None,
        "review_comments": ""
    }
    
    result = task_evidence_collection.insert_one(evidence_doc)
    
    tasks_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "status": "Under Review",
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    try:
        from routes.notifications import create_notification_internal
        # Notify the intern deliverable is Under Review
        create_notification_internal(
            caller_id,
            "Task Deliverable Submitted",
            f"Your deliverable for '{task.get('title')}' has been submitted and is Under Review.",
            "task_under_review"
        )
        # Notify project lead that review is needed
        lead_id = task.get("assigned_by")
        if lead_id and lead_id != caller_id:
            create_notification_internal(
                lead_id,
                "Review Required",
                f"A new deliverable for task '{task.get('title')}' is awaiting your review.",
                "task_review_needed"
            )
    except Exception as e:
        print("Failed to trigger task submission notifications:", e)

    return jsonify({
        "success": True,
        "message": "Task deliverable submitted, status set to Under Review",
        "evidence_id": str(result.inserted_id)
    }), 201

@tasks_bp.route("/<task_id>/evidence/review", methods=["POST"])
def review_evidence(task_id):
    if not ObjectId.is_valid(task_id):
        return jsonify({"success": False, "message": "Invalid task ID"}), 400
        
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    caller_id = caller["id"]
    
    task = tasks_collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        return jsonify({"success": False, "message": "Task not found"}), 404
        
    project_id = task.get("project_id")
    proj_query = {"_id": ObjectId(project_id) if ObjectId.is_valid(project_id) else project_id}
    project = projects_collection.find_one(proj_query)
    if not project:
        return jsonify({"success": False, "message": "Project not found for this task"}), 404
        
    # Evidence review allowed only when project.lead_id == current_user.id
    if str(project.get("lead_id", "")) != caller_id:
        return jsonify({"success": False, "message": "Forbidden: Only the project's Team Lead may review evidence"}), 403
        
    data = request.json
    status = data.get("status")
    review_comments = data.get("review_comments", "")
    
    if status not in ["approved", "rejected"]:
        return jsonify({"success": False, "message": "Invalid review status"}), 400
        
    evidence_status = "approved" if status == "approved" else "rejected"
    latest_evidence = task_evidence_collection.find_one(
        {"task_id": ObjectId(task_id)},
        sort=[("submitted_at", -1)]
    )
    if latest_evidence:
        task_evidence_collection.update_one(
            {"_id": latest_evidence["_id"]},
            {"$set": {
                "status": evidence_status,
                "review_comments": review_comments,
                "reviewed_by": caller_id,
                "reviewed_at": datetime.utcnow().isoformat()
            }}
        )
    
    new_task_status = "Approved" if status == "approved" else "Rejected"
    tasks_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "status": new_task_status,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    try:
        from routes.notifications import create_notification_internal
        assigned_to = task.get("assigned_to")
        title = task.get("title", "")
        if new_task_status == "Approved":
            create_notification_internal(
                assigned_to,
                "Task Completed",
                f"Congratulations! Your deliverable for task '{title}' has been approved.",
                "task_completed"
            )
        else:
            create_notification_internal(
                assigned_to,
                "Task Deliverable Rejected",
                f"Your deliverable for task '{title}' was rejected. Reason: {review_comments}",
                "task_rejected"
            )
    except Exception as e:
        print("Failed to trigger task review notification:", e)

    return jsonify({
        "success": True,
        "message": f"Deliverable review completed. Task status set to {new_task_status}"
    })

@tasks_bp.route("/evidence/project/<project_id>", methods=["GET"])
def get_project_evidence(project_id):
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    caller_role = caller.get("role", "intern")
    caller_id = caller["id"]
    
    proj_query = {"_id": ObjectId(project_id) if ObjectId.is_valid(project_id) else project_id}
    project = projects_collection.find_one(proj_query)
    if not project:
        return jsonify({"success": False, "message": "Project not found"}), 404
        
    member_ids_str = [str(mid) for mid in project.get("member_ids", [])]
    if caller_role == "intern":
        if caller_id not in member_ids_str:
            return jsonify({"success": False, "message": "Forbidden: You are not a member of this project"}), 403
            
    if caller_role == "team_lead" and str(project.get("lead_id", "")) != caller_id:
        return jsonify({"success": False, "message": "Forbidden: You do not lead this project"}), 403

    query = {"project_id": project_id}
    if ObjectId.is_valid(project_id):
        query = {"$or": [{"project_id": project_id}, {"project_id": ObjectId(project_id)}]}
        
    raw_evidence = list(task_evidence_collection.find(query).sort("submitted_at", -1))
    
    filtered_evidence = []
    user_ids = set()
    task_ids = set()
    
    for ev in raw_evidence:
        ev = serialize_doc(ev)
        uploaded_by_str = str(ev.get("uploaded_by", ""))
        if caller_role == "intern" and uploaded_by_str != caller_id:
            continue
            
        filtered_evidence.append(ev)
        if ev.get("uploaded_by"):
            user_ids.add(ev.get("uploaded_by"))
        if ev.get("task_id"):
            task_ids.add(ev.get("task_id"))
            
    user_query_ids = []
    for uid in user_ids:
        if ObjectId.is_valid(uid):
            user_query_ids.append(ObjectId(uid))
        user_query_ids.append(uid)
        
    task_query_ids = []
    for tid in task_ids:
        if ObjectId.is_valid(tid):
            task_query_ids.append(ObjectId(tid))
        task_query_ids.append(tid)
        
    users_dict = {}
    if user_query_ids:
        for u in users_collection.find({"_id": {"$in": user_query_ids}}):
            users_dict[str(u["_id"])] = u.get("name")
            
    tasks_dict = {}
    if task_query_ids:
        for t in tasks_collection.find({"_id": {"$in": task_query_ids}}):
            tasks_dict[str(t["_id"])] = t.get("title")
            
    evidence_list = []
    for ev in filtered_evidence:
        u_id_str = str(ev.get("uploaded_by", ""))
        if u_id_str in users_dict:
            ev["user_name"] = users_dict[u_id_str]
            
        t_id_str = str(ev.get("task_id", ""))
        if t_id_str in tasks_dict:
            ev["task_title"] = tasks_dict[t_id_str]
            
        evidence_list.append(ev)
        
    return jsonify(evidence_list)

@tasks_bp.route("/user/<user_id>", methods=["GET"])
def get_user_tasks(user_id):
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    caller_role = caller.get("role", "intern")
    caller_id = caller["id"]
    if caller_role == "intern" and caller_id != user_id:
        return jsonify({"success": False, "message": "Forbidden"}), 403
        
    query = {"assigned_to": user_id}
    if ObjectId.is_valid(user_id):
        query = {"$or": [{"assigned_to": user_id}, {"assigned_to": ObjectId(user_id)}]}
        
    task_docs = list(tasks_collection.find(query))
    tasks = _hydrate_tasks(task_docs, resolve_evidence=True, evidence_user_id=user_id)
    return jsonify(tasks)

@tasks_bp.route("/evidence", methods=["GET"])
def get_all_evidence():
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    caller_role = caller.get("role", "intern")
    caller_id = caller["id"]
    
    target_user_id = request.args.get("user_id") or request.args.get("employee_id")
    has_user_filter = ("user_id" in request.args) or ("employee_id" in request.args)
    if has_user_filter and not target_user_id:
        target_user_id = "non_existent_id"

    query = {}
    if caller_role == "intern":
        query = {"uploaded_by": caller_id}
    elif caller_role in ["team_lead", "team lead"]:
        proj_lead_query = {"lead_id": caller_id}
        if ObjectId.is_valid(caller_id):
            proj_lead_query = {"$or": [{"lead_id": caller_id}, {"lead_id": ObjectId(caller_id)}]}
        led_project_ids = [str(p["_id"]) for p in projects_collection.find(proj_lead_query)]
        proj_oids = [ObjectId(pid) for pid in led_project_ids if ObjectId.is_valid(pid)]
        
        if has_user_filter:
            if not target_user_id or target_user_id == "non_existent_id":
                return jsonify([])
            allowed_members = set()
            for p in projects_collection.find(proj_lead_query):
                for mid in p.get("member_ids", []):
                    allowed_members.add(str(mid))
            if target_user_id in allowed_members:
                query = {"uploaded_by": target_user_id}
            else:
                return jsonify([])
        else:
            query = {"project_id": {"$in": led_project_ids}}
            if proj_oids:
                query = {"$or": [{"project_id": {"$in": led_project_ids}}, {"project_id": {"$in": proj_oids}}]}
    else: # admin
        if has_user_filter or target_user_id:
            query = {"uploaded_by": target_user_id or "non_existent_id"}
            
    if "uploaded_by" in query:
        uid = query["uploaded_by"]
        if ObjectId.is_valid(uid):
            query = {"$or": [{"uploaded_by": uid}, {"uploaded_by": ObjectId(uid)}]}
        else:
            try:
                legacy_int = int(uid)
                query = {"$or": [{"uploaded_by": uid}, {"uploaded_by": legacy_int}]}
            except (ValueError, TypeError):
                pass
            
    raw_evidence = list(task_evidence_collection.find(query).sort("submitted_at", -1))
    
    user_ids = set()
    task_ids = set()
    project_ids = set()
    
    for ev in raw_evidence:
        if ev.get("uploaded_by"):
            user_ids.add(ev.get("uploaded_by"))
        if ev.get("task_id"):
            task_ids.add(ev.get("task_id"))
        if ev.get("project_id"):
            project_ids.add(ev.get("project_id"))
            
    user_query_ids = []
    for uid in user_ids:
        if ObjectId.is_valid(uid):
            user_query_ids.append(ObjectId(uid))
        user_query_ids.append(uid)
        
    task_query_ids = []
    for tid in task_ids:
        if ObjectId.is_valid(tid):
            task_query_ids.append(ObjectId(tid))
        task_query_ids.append(tid)
        
    project_query_ids = []
    for pid in project_ids:
        if ObjectId.is_valid(pid):
            project_query_ids.append(ObjectId(pid))
        project_query_ids.append(pid)
        
    users_dict = {}
    if user_query_ids:
        for u in users_collection.find({"_id": {"$in": user_query_ids}}):
            users_dict[str(u["_id"])] = u.get("name")
            
    tasks_dict = {}
    if task_query_ids:
        for t in tasks_collection.find({"_id": {"$in": task_query_ids}}):
            tasks_dict[str(t["_id"])] = t.get("title")
            
    projects_dict = {}
    if project_query_ids:
        for p in projects_collection.find({"_id": {"$in": project_query_ids}}):
            projects_dict[str(p["_id"])] = p.get("name")
            
    evidence_list = []
    for ev in raw_evidence:
        ev = serialize_doc(ev)
        
        u_id_str = str(ev.get("uploaded_by", ""))
        if u_id_str in users_dict:
            ev["user_name"] = users_dict[u_id_str]
            
        t_id_str = str(ev.get("task_id", ""))
        if t_id_str in tasks_dict:
            ev["task_title"] = tasks_dict[t_id_str]
            
        p_id_str = str(ev.get("project_id", ""))
        if p_id_str in projects_dict:
            ev["project_name"] = projects_dict[p_id_str]
            
        evidence_list.append(ev)
        
    return jsonify(evidence_list)
