from flask import Blueprint, jsonify, request
import json
from database.mongodb import users_collection

from bson import ObjectId
from utils.serializer import serialize_doc

users_bp = Blueprint(
    "users",
    __name__,
    url_prefix="/users"
)

@users_bp.route("/", methods=["GET"])
def get_users():
    users = []
    for user in users_collection.find():
        user["id"] = str(user["_id"])
        del user["_id"]
        if "password" in user:
            del user["password"]
        if "password_hash" in user:
            del user["password_hash"]
        users.append(user)
    return jsonify(users)

@users_bp.route("/list", methods=["GET"])
def get_users_list():
    users = []
    for user in users_collection.find({}, {"name": 1, "role": 1, "avatarColor": 1, "email": 1}):
        users.append({
            "_id": str(user["_id"]),
            "id": str(user["_id"]),
            "name": user.get("name", ""),
            "role": user.get("role", "intern"),
            "avatarColor": user.get("avatarColor", ""),
            "email": user.get("email", "")
        })
    return jsonify(users)

@users_bp.route("/<user_id>/toggle-active", methods=["POST"])
def toggle_active(user_id):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        # Toggle activation
        new_status = not user.get("is_active", True)
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"is_active": new_status}}
        )
        return jsonify({"success": True, "message": "User status updated", "is_active": new_status})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@users_bp.route("/<user_id>/change-role", methods=["POST"])
def change_role(user_id):
    try:
        data = request.json
        new_role = data.get("role")
        if new_role not in ["admin", "team_lead", "intern"]:
            return jsonify({"success": False, "message": "Invalid role"}), 400

        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"role": new_role}}
        )
        return jsonify({"success": True, "message": f"User role updated to {new_role}", "role": new_role})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@users_bp.route("/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        users_collection.delete_one({"_id": ObjectId(user_id)})
        return jsonify({"success": True, "message": "User deleted successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400
