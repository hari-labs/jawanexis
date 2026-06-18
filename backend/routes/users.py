from flask import Blueprint, jsonify
import json
from database.mongodb import users_collection

from bson import ObjectId
from utils.serializer import serialize_doc

users_bp = Blueprint(
    "users",
    __name__,
    url_prefix="/users"
)

@users_bp.route("/", methods=["GET"])
def get_users():

    users = []

    for user in users_collection.find():

        user["id"] = str(user["_id"])

        del user["_id"]

        users.append(user)

    return jsonify(users)

