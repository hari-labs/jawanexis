from flask import Blueprint, jsonify

from database.mongodb import applications_collection


applications_bp = Blueprint(
    "applications",
    __name__,
    url_prefix="/applications"
)


@applications_bp.route("/", methods=["GET"])
def get_applications():

    applications = list(
        applications_collection.find({}, {"_id": 0})
    )

    return jsonify(applications)