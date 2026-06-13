from flask import Blueprint, jsonify
import json

activities_bp = Blueprint(
    "activities",
    __name__,
    url_prefix="/activities"
)


@activities_bp.route("/", methods=["GET"])
def get_activities():

    with open("data/activities.json", "r") as file:
        activities = json.load(file)

    return jsonify(activities)