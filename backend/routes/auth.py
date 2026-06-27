from flask import Blueprint, request, jsonify
from bson import ObjectId
from database.mongodb import users_collection
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/auth"
)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    # Check activation state
    if not user.get("is_active", True):
        return jsonify({"success": False, "message": "Account is deactivated"}), 403

    # Check password_hash
    pwd_hash = user.get("password_hash")
    if not pwd_hash or not check_password_hash(pwd_hash, password):
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    # Auto-update desktop agent config on login if on the same system
    import json
    import os
    try:
        agent_config_dirs = [
            "d:\\InternManagingApp\\desktop_agent\\storage",
            "../InternManagingApp/desktop_agent/storage",
            "../../InternManagingApp/desktop_agent/storage"
        ]
        for dir_path in agent_config_dirs:
            if os.path.exists(dir_path):
                config_file = os.path.join(dir_path, "agent_config.json")
                config_data = {}
                if os.path.exists(config_file):
                    try:
                        with open(config_file, "r") as f:
                            config_data = json.load(f)
                    except Exception:
                        pass
                config_data["email"] = user["email"]
                config_data["user_id"] = str(user["_id"])
                config_data["backend_url"] = os.getenv("BACKEND_URL", "http://127.0.0.1:5000")
                config_data["poll_interval_seconds"] = 5
                with open(config_file, "w") as f:
                    json.dump(config_data, f, indent=2)
                print(f"Updated agent config for user {user['email']} at {config_file}")
                break
    except Exception as e:
        print("Failed to auto-update desktop agent config on login:", e)

    return jsonify({
        "success": True,
        "role": user["role"],
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "user_id": user.get("user_id")
        }
    })


@auth_bp.route("/logout", methods=["POST"])
def logout():
    return jsonify({"success": True, "message": "Logged out successfully"})


@auth_bp.route("/me/<user_id>", methods=["GET"])
def get_me(user_id):
    if not ObjectId.is_valid(user_id):
        return jsonify({"success": False, "message": "Invalid user ID"}), 400
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    return jsonify({
        "success": True,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "is_active": user.get("is_active", True),
            "user_id": user.get("user_id")
        }
    })