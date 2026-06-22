from flask import Blueprint, jsonify , request

from database.mongodb import applications_collection

from bson import ObjectId
from utils.serializer import serialize_doc


applications_bp = Blueprint(
    "applications",
    __name__,
    url_prefix="/applications"
)

@applications_bp.route("/", methods=["GET"])
def get_applications():

    applications = []

    for app in applications_collection.find():
        applications.append(
            serialize_doc(app)
        )

    return jsonify(applications)

@applications_bp.route("/", methods=["POST"])
def create_application():
    data = dict(request.json or {})
    
    app_name = data.get("application_name") or data.get("app_name") or "No Application Metadata"
    if app_name == "Unknown":
        app_name = "No Application Metadata"
    
    win_title = data.get("window_title") or data.get("title") or ""
    if win_title == "Unknown":
        win_title = ""
        
    dur = data.get("duration_seconds") or data.get("duration") or 0
    try:
        dur = int(dur)
    except (ValueError, TypeError):
        dur = 0
        
    data["application_name"] = app_name
    data["app_name"] = app_name
    data["window_title"] = win_title
    data["title"] = win_title
    data["duration_seconds"] = dur
    
    from utils.serializer import populate_user_details
    populate_user_details(data)

    result = applications_collection.insert_one(data)

    return jsonify({
        "message": "Application created",
        "id": str(result.inserted_id)
    }), 201