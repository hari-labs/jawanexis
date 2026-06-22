from flask import Blueprint, jsonify, request

from database.mongodb import sessions_collection

from bson import ObjectId

from utils.serializer import serialize_doc

sessions_bp = Blueprint(
    "sessions",
    __name__,
    url_prefix="/sessions"
)


@sessions_bp.route("/", methods=["GET"])
def get_sessions():

    sessions = []

    for session in sessions_collection.find():
        sessions.append(
            serialize_doc(session)
        )

    return jsonify(sessions)

@sessions_bp.route("/", methods=["POST"])
def create_session():

    data = request.json
    from utils.serializer import populate_user_details
    populate_user_details(data)

    result = sessions_collection.insert_one(data)

    return jsonify({
        "message": "Session created",
        "id": str(result.inserted_id)
    }), 201

@sessions_bp.route("/<session_id>", methods=["PATCH", "PUT"])
def update_session(session_id):
    if not ObjectId.is_valid(session_id):
        return jsonify({"success": False, "message": "Invalid session ID"}), 400
    data = request.json
    if "_id" in data:
        del data["_id"]
    sessions_collection.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": data}
    )
    return jsonify({"success": True, "message": "Session updated"})