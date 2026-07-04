from flask import Blueprint, jsonify
from database.mongodb import projects_collection, users_collection
from bson import ObjectId

teams_bp = Blueprint("teams", __name__, url_prefix="/teams")

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

@teams_bp.route("/members/<team_lead_id>", methods=["GET"])
def get_team_members(team_lead_id):
    lead_oids = [team_lead_id]
    if ObjectId.is_valid(team_lead_id):
        lead_oids.append(ObjectId(team_lead_id))
        
    # Find all projects led by this team lead
    lead_projects = list(projects_collection.find({"lead_id": {"$in": lead_oids}}))
    
    member_ids = set()
    for p in lead_projects:
        mids = p.get("member_ids", [])
        if isinstance(mids, list):
            for mid in mids:
                member_ids.add(mid)
                
    members = []
    for mid in member_ids:
        resolved = resolve_user(mid)
        if resolved:
            members.append(resolved)
            
    return jsonify(members)

@teams_bp.route("/overview", methods=["GET"])
def get_teams_overview():
    projects = list(projects_collection.find())
    
    # --- BATCH PRELOAD ---
    all_uids_set = set()
    for p in projects:
        lead_id = p.get("lead_id")
        if lead_id:
            all_uids_set.add(str(lead_id))
        for mid in p.get("member_ids", []):
            if mid:
                all_uids_set.add(str(mid))
                
    all_uids = list(all_uids_set)
    
    # 1. Users Dict
    from database.mongodb import monitoring_states_collection, db
    
    user_query_ids = []
    for u in all_uids:
        user_query_ids.append(u)
        if ObjectId.is_valid(u):
            user_query_ids.append(ObjectId(u))
            
    users_cursor = users_collection.find({"_id": {"$in": user_query_ids}})
    users_dict = {}
    for u in users_cursor:
        users_dict[str(u["_id"])] = u
        if u.get("user_id"):
            users_dict[str(u.get("user_id"))] = u
    
    # 2. States Dict
    states_cursor = monitoring_states_collection.find({"user_id": {"$in": all_uids}})
    states_dict = {str(s["user_id"]): s for s in states_cursor}
    
    # 3. Summaries Dict
    daily_summaries_collection = db["daily_summaries"]
    from datetime import datetime, timedelta
    today_local = datetime.utcnow() + timedelta(minutes=330)
    today_str = today_local.strftime("%Y-%m-%d")
    
    summaries_cursor = daily_summaries_collection.find({"user_id": {"$in": all_uids}})
    preloaded_summaries = {}
    
    for doc in summaries_cursor:
        doc.pop("_id", None)
        preloaded_summaries[(str(doc["user_id"]), doc["date"])] = doc

    from config.productivity_rules import calculate_productivity
    
    overview = []
    for p in projects:
        p_id = str(p["_id"])
        
        lead_id = str(p.get("lead_id")) if p.get("lead_id") else None
        lead_user = users_dict.get(lead_id) if lead_id else None
        
        if lead_user:
            lead = {
                "id": str(lead_user["_id"]),
                "name": lead_user.get("name", "Unknown"),
                "email": lead_user.get("email", ""),
                "role": lead_user.get("role", "intern"),
                "avatarColor": lead_user.get("avatarColor", "")
            }
        else:
            lead = {"id": "", "name": "Unassigned", "email": ""}
            
        member_ids = p.get("member_ids", [])
        if not isinstance(member_ids, list):
            member_ids = []
            
        members = []
        total_productivity = 0
        total_work_hours = 0
        
        for mid in member_ids:
            mid_str = str(mid)
            user = users_dict.get(mid_str)
            
            if user:
                user_id_str = str(user["_id"])
                
                # Reconstruct historical dates from cached keys, skipping today if it was cached
                user_dates = [k[1] for k in preloaded_summaries.keys() if k[0] == user_id_str and k[1] != today_str]
                user_dates.append(today_str)
                
                res = calculate_productivity(
                    user_id_str, 
                    user_dates, 
                    preloaded_summaries=preloaded_summaries, 
                    state_doc=states_dict.get(user_id_str)
                )
                
                prod = float(res["productivity"])
                hours = round(res["active_minutes"] / 60.0, 1)
                    
                total_productivity += prod
                total_work_hours += hours
                
                members.append({
                    "id": user_id_str,
                    "name": user.get("name", "Unknown"),
                    "email": user.get("email", ""),
                    "status": user.get("status", "offline"),
                    "productivity": prod,
                    "workHours": hours
                })
                
        avg_productivity = (total_productivity / len(members)) if members else 0.0
        
        overview.append({
            "project": {
                "id": p_id,
                "name": p.get("name", "Unknown"),
                "status": p.get("status", "in_progress")
            },
            "lead": lead,
            "members": members,
            "metrics": {
                "member_count": len(members),
                "avg_productivity": round(avg_productivity, 1),
                "total_work_hours": round(total_work_hours, 1)
            }
        })
        
    return jsonify(overview)
