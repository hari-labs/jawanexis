from flask import Blueprint, request, jsonify
from database.mongodb import notifications_collection
from bson import ObjectId
from utils.serializer import serialize_doc
from datetime import datetime

notifications_bp = Blueprint(
    "notifications",
    __name__
)

def create_notification_internal(user_id, title, message, type_name):
    try:
        notifications_collection.insert_one({
            "user_id": str(user_id),
            "title": title,
            "message": message,
            "type": type_name,
            "is_read": False,
            "created_at": datetime.utcnow().isoformat() + "Z"
        })
    except Exception as e:
        print("Failed to insert notification:", e)

@notifications_bp.route("/", methods=["POST"])
def create_notification():
    data = request.json
    if "is_read" not in data:
        data["is_read"] = False
    if "created_at" not in data:
        data["created_at"] = datetime.utcnow().isoformat() + "Z"
    
    result = notifications_collection.insert_one(data)
    return jsonify({
        "message": "Notification created",
        "id": str(result.inserted_id)
    }), 201

@notifications_bp.route("/", methods=["GET"])
def get_notifications():
    user_id = request.args.get("user_id")
    query = {}
    if user_id:
        query["user_id"] = str(user_id)
        
    notifications = []
    # Sort notifications by created_at descending
    for notification in notifications_collection.find(query).sort("created_at", -1).limit(50):
        notifications.append(
            serialize_doc(notification)
        )
    return jsonify(notifications)

@notifications_bp.route("/<id>/read", methods=["PUT"])
def mark_read(id):
    try:
        notifications_collection.update_one(
            {"_id": ObjectId(id) if ObjectId.is_valid(id) else id},
            {"$set": {"is_read": True}}
        )
        return jsonify({"success": True, "message": "Notification marked as read"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@notifications_bp.route("/mark-all-read", methods=["PUT"])
def mark_all_read():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "user_id parameter is required"}), 400
    try:
        notifications_collection.update_many(
            {"user_id": str(user_id)},
            {"$set": {"is_read": True}}
        )
        return jsonify({"success": True, "message": "All notifications marked as read"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400