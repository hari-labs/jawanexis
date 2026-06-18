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

    result = sessions_collection.insert_one(data)

    return jsonify({
        "message": "Session created",
        "id": str(result.inserted_id)
    }), 201