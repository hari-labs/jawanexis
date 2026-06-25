from flask import Blueprint, jsonify, request
from database.mongodb import projects_collection, users_collection, tasks_collection
from bson import ObjectId
from datetime import datetime

projects_bp = Blueprint("projects", __name__, url_prefix="/projects")

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

def resolve_user(uid):
    if not uid:
        return None
    try:
        user = None
        if ObjectId.is_valid(uid):
            user = users_collection.find_one({"_id": ObjectId(uid)})
        if not user:
            user = users_collection.find_one({"_id": uid})
        if user:
            return {
                "id": str(user["_id"]),
                "name": user.get("name", "Unknown"),
                "email": user.get("email", ""),
                "role": user.get("role", "intern"),
                "avatarColor": user.get("avatarColor", "")
            }
    except Exception:
        pass
    return None

def get_project_stats(project_id):
    query = {"project_id": str(project_id)}
    if ObjectId.is_valid(project_id):
        query = {"$or": [{"project_id": str(project_id)}, {"project_id": ObjectId(project_id)}]}
    
    total = tasks_collection.count_documents(query)
    approved = tasks_collection.count_documents({"$and": [query, {"status": "Approved"}]})
    completed = tasks_collection.count_documents({"$and": [query, {"status": "Completed"}]})
    pending = tasks_collection.count_documents({"$and": [query, {"status": "Pending"}]})
    rejected = tasks_collection.count_documents({"$and": [query, {"status": "Rejected"}]})
    
    progress = int(round((approved / total) * 100)) if total > 0 else 0
    return {
        "progress": progress,
        "total_tasks": total,
        "approved_tasks": approved,
        "completed_tasks": completed,
        "pending_tasks": pending,
        "rejected_tasks": rejected
    }

@projects_bp.route("/", methods=["GET"])
def get_projects():
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    caller_role = caller.get("role", "intern")
    caller_id = caller["id"]
    
    query = {}
    if caller_role == "intern":
        query = {"member_ids": {"$in": [caller_id, ObjectId(caller_id) if ObjectId.is_valid(caller_id) else None]}}
    elif caller_role == "team_lead":
        query = {"lead_id": {"$in": [caller_id, ObjectId(caller_id) if ObjectId.is_valid(caller_id) else None]}}
        
    projects = []
    for p in projects_collection.find(query):
        p["id"] = str(p["_id"])
        del p["_id"]
        
        lead_id = p.get("lead_id")
        p["lead"] = resolve_user(lead_id)
        
        members = []
        member_ids = p.get("member_ids", [])
        if not isinstance(member_ids, list):
            member_ids = []
        for mid in member_ids:
            resolved = resolve_user(mid)
            if resolved:
                members.append(resolved)
        p["members"] = members
        
        # Inject dynamic progress statistics
        stats = get_project_stats(p["id"])
        p.update(stats)
        
        projects.append(p)
    return jsonify(projects)

@projects_bp.route("/", methods=["POST"])
def create_project():
    caller = get_caller_user()
    if not caller or caller.get("role") != "admin":
        return jsonify({"success": False, "message": "Forbidden: Only Admin may manage projects"}), 403
        
    data = request.json
    
    lead_id = data.get("lead_id")
    member_ids = data.get("member_ids", [])
    if not isinstance(member_ids, list):
        member_ids = []
        
    project_doc = {
        "name": data.get("name"),
        "description": data.get("description", ""),
        "status": data.get("status", "in_progress"),
        "start_date": data.get("start_date", datetime.utcnow().isoformat().split('T')[0]),
        "end_date": data.get("end_date", ""),
        "lead_id": lead_id,
        "member_ids": member_ids,
        "created_by": data.get("created_by", "admin"),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    result = projects_collection.insert_one(project_doc)
    try:
        from routes.notifications import create_notification_internal
        # Notify Team Lead
        if lead_id:
            create_notification_internal(
                lead_id,
                "New Project Assigned",
                f"You have been assigned as the Team Lead for project: {project_doc['name']}",
                "project_assigned"
            )
        # Notify Member Interns
        for mid in member_ids:
            if str(mid) != str(lead_id):
                create_notification_internal(
                    mid,
                    "New Project Assigned",
                    f"You have been assigned as a member of project: {project_doc['name']}",
                    "project_assigned"
                )
    except Exception as e:
        print("Failed to trigger project creation notifications:", e)
        
    return jsonify({"success": True, "id": str(result.inserted_id)}), 201

@projects_bp.route("/<project_id>", methods=["PATCH", "PUT"])
def edit_project(project_id):
    if not ObjectId.is_valid(project_id):
        return jsonify({"success": False, "message": "Invalid project ID"}), 400
        
    caller = get_caller_user()
    if not caller or caller.get("role") != "admin":
        return jsonify({"success": False, "message": "Forbidden: Only Admin may manage projects"}), 403
        
    data = request.json
    
    update_fields = {}
    for key in ["name", "description", "status", "start_date", "end_date", "lead_id", "member_ids"]:
        if key in data:
            update_fields[key] = data[key]
            
    update_fields["updated_at"] = datetime.utcnow().isoformat()
            
    old_project = projects_collection.find_one({"_id": ObjectId(project_id)})
    
    projects_collection.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": update_fields}
    )
    
    if old_project:
        try:
            from routes.notifications import create_notification_internal
            # If lead changed
            new_lead = update_fields.get("lead_id") or old_project.get("lead_id")
            if "lead_id" in update_fields and str(update_fields["lead_id"]) != str(old_project.get("lead_id")):
                create_notification_internal(
                    new_lead,
                    "New Project Assigned",
                    f"You have been assigned as the Team Lead for project: {old_project.get('name')}",
                    "project_assigned"
                )
            # If member_ids changed
            if "member_ids" in update_fields:
                old_mids = {str(m) for m in old_project.get("member_ids", [])}
                new_mids = {str(m) for m in update_fields["member_ids"]}
                added_mids = new_mids - old_mids
                for mid in added_mids:
                    create_notification_internal(
                        mid,
                        "New Project Assigned",
                        f"You have been assigned as a member of project: {old_project.get('name')}",
                        "project_assigned"
                    )
        except Exception as e:
            print("Failed to trigger project update notifications:", e)

    return jsonify({"success": True, "message": "Project updated"})

@projects_bp.route("/<project_id>", methods=["DELETE"])
def delete_project(project_id):
    if not ObjectId.is_valid(project_id):
        return jsonify({"success": False, "message": "Invalid project ID"}), 400
        
    caller = get_caller_user()
    if not caller or caller.get("role") != "admin":
        return jsonify({"success": False, "message": "Forbidden: Only Admin may manage projects"}), 403
        
    result = projects_collection.delete_one({"_id": ObjectId(project_id)})
    if result.deleted_count == 0:
        return jsonify({"success": False, "message": "Project not found"}), 404
    return jsonify({"success": True, "message": "Project deleted successfully"})

@projects_bp.route("/<project_id>/archive", methods=["POST"])
def archive_project(project_id):
    if not ObjectId.is_valid(project_id):
        return jsonify({"success": False, "message": "Invalid project ID"}), 400
        
    caller = get_caller_user()
    if not caller or caller.get("role") != "admin":
        return jsonify({"success": False, "message": "Forbidden: Only Admin may manage projects"}), 403
        
    projects_collection.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": {
            "status": "archived",
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    return jsonify({"success": True, "message": "Project archived"})

@projects_bp.route("/assigned/<user_id>", methods=["GET"])
def get_assigned_projects(user_id):
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    if caller.get("role") != "admin" and caller["id"] != user_id:
        return jsonify({"success": False, "message": "Forbidden: Cannot query assignments of another user"}), 403

    user_oids = [user_id]
    if ObjectId.is_valid(user_id):
        user_oids.append(ObjectId(user_id))
        
    query = {
        "$or": [
            {"lead_id": {"$in": user_oids}},
            {"member_ids": {"$in": user_oids}}
        ]
    }
    
    projects = []
    for p in projects_collection.find(query):
        p["id"] = str(p["_id"])
        del p["_id"]
        
        lead_id = p.get("lead_id")
        p["lead"] = resolve_user(lead_id)
        
        members = []
        member_ids = p.get("member_ids", [])
        if not isinstance(member_ids, list):
            member_ids = []
        for mid in member_ids:
            resolved = resolve_user(mid)
            if resolved:
                members.append(resolved)
        p["members"] = members
        
        # Inject dynamic progress statistics
        stats = get_project_stats(p["id"])
        p.update(stats)
        
        projects.append(p)
        
    return jsonify(projects)
