from flask import Blueprint, request, jsonify
from database.mongodb import activities_collection

activities_bp = Blueprint("activities", __name__)

from bson import ObjectId

from utils.serializer import serialize_doc


@activities_bp.route("/", methods=["POST"])
def create_activity():

    data = request.json

    result = activities_collection.insert_one(data)

    return jsonify({
        "message": "Activity created",
        "id": str(result.inserted_id)
    }), 201


@activities_bp.route("/", methods=["GET"])
def get_activities():

    activities = []

    for activity in activities_collection.find():
        activities.append(
            serialize_doc(activity)
        )

    return jsonify(activities)