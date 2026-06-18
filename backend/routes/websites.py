from flask import Blueprint, jsonify , request

from database.mongodb import websites_collection

from bson import ObjectId

from utils.serializer import serialize_doc

websites_bp = Blueprint(
    "websites",
    __name__,
    url_prefix="/websites"
)

@websites_bp.route("/", methods=["GET"])
def get_websites():

    websites = []

    for website in websites_collection.find():
        websites.append(
            serialize_doc(website)
        )

    return jsonify(websites)

@websites_bp.route("/", methods=["POST"])
def create_website():

    data = request.json

    result = websites_collection.insert_one(data)

    return jsonify({
        "message": "Website created",
        "id": str(result.inserted_id)
    }), 201