from flask import Blueprint, jsonify

from database.mongodb import sessions_collection


sessions_bp = Blueprint(
    "sessions",
    __name__,
    url_prefix="/sessions"
)


@sessions_bp.route("/", methods=["GET"])
def get_sessions():

    sessions = list(
        sessions_collection.find({}, {"_id": 0})
    )

    return jsonify(sessions)