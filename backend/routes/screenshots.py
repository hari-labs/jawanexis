from flask import Blueprint, jsonify , request

from database.mongodb import screenshots_collection

from bson import ObjectId

from utils.serializer import serialize_doc

screenshots_bp = Blueprint(
    "screenshots",
    __name__,
    url_prefix="/screenshots"
)


@screenshots_bp.route("/", methods=["GET"])
def get_screenshots():

    screenshots = []

    for screenshot in screenshots_collection.find():
        screenshots.append(
            serialize_doc(screenshot)
        )

    return jsonify(screenshots)

@screenshots_bp.route("/", methods=["POST"])
def create_screenshot():

    data = request.json

    result = screenshots_collection.insert_one(data)

    return jsonify({
        "message": "Screenshot created",
        "id": str(result.inserted_id)
    }), 201