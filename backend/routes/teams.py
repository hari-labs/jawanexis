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
    overview = []
    for p in projects_collection.find():
        p_id = str(p["_id"])
        
        lead_id = p.get("lead_id")
        lead = resolve_user(lead_id)
        if not lead:
            lead = {"id": "", "name": "Unassigned", "email": ""}
            
        member_ids = p.get("member_ids", [])
        if not isinstance(member_ids, list):
            member_ids = []
            
        members = []
        total_productivity = 0
        total_work_hours = 0
        
        for mid in member_ids:
            user = None
            if ObjectId.is_valid(mid):
                user = users_collection.find_one({"_id": ObjectId(mid)})
            if not user:
                user = users_collection.find_one({"_id": mid})
                
            if user:
                prod = user.get("productivity", 0)
                hours = user.get("workHours", 0)
                try:
                    prod = float(prod)
                except (ValueError, TypeError):
                    prod = 0.0
                try:
                    hours = float(hours)
                except (ValueError, TypeError):
                    hours = 0.0
                    
                total_productivity += prod
                total_work_hours += hours
                
                members.append({
                    "id": str(user["_id"]),
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
