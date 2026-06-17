from flask import Blueprint, jsonify

from database.mongodb import websites_collection


websites_bp = Blueprint(
    "websites",
    __name__,
    url_prefix="/websites"
)


@websites_bp.route("/", methods=["GET"])
def get_websites():

    websites = list(
        websites_collection.find({}, {"_id": 0})
    )

    return jsonify(websites)