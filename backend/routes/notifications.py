from flask import Blueprint, request, jsonify
from database.mongodb import notifications_collection

from bson import ObjectId

from utils.serializer import serialize_doc

notifications_bp = Blueprint(
    "notifications",
    __name__
)


@notifications_bp.route("/", methods=["POST"])
def create_notification():

    data = request.json

    result = notifications_collection.insert_one(data)

    return jsonify({
        "message": "Notification created",
        "id": str(result.inserted_id)
    }), 201


@notifications_bp.route("/", methods=["GET"])
def get_notifications():

    notifications = []

    for notification in notifications_collection.find():
        notifications.append(
            serialize_doc(notification)
        )

    return jsonify(notifications)