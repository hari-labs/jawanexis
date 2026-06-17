from flask import Blueprint, jsonify

from database.mongodb import screenshots_collection


screenshots_bp = Blueprint(
    "screenshots",
    __name__,
    url_prefix="/screenshots"
)


@screenshots_bp.route("/", methods=["GET"])
def get_screenshots():

    screenshots = list(
        screenshots_collection.find({}, {"_id": 0})
    )

    return jsonify(screenshots)