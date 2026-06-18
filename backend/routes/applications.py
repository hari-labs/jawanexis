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

    data = request.json

    result = applications_collection.insert_one(data)

    return jsonify({
        "message": "Application created",
        "id": str(result.inserted_id)
    }), 201