from flask import Blueprint, jsonify
import json

screenshots_bp = Blueprint(
    "screenshots",
    __name__,
    url_prefix="/screenshots"
)


@screenshots_bp.route("/", methods=["GET"])
def get_screenshots():

    with open("data/screenshots.json", "r") as file:
        screenshots = json.load(file)

    return jsonify(screenshots)