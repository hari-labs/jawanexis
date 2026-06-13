from flask import Blueprint, jsonify
import json

sessions_bp = Blueprint(
    "sessions",
    __name__,
    url_prefix="/sessions"
)


@sessions_bp.route("/", methods=["GET"])
def get_sessions():

    with open("data/sessions.json", "r") as file:
        sessions = json.load(file)

    return jsonify(sessions)