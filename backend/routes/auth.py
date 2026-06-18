from flask import Blueprint, request, jsonify

from bson import ObjectId

from utils.serializer import serialize_doc

auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/auth"
)


@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.json

    email = data["email"]

    if "admin" in email:

        role = "admin"

    else:

        role = "intern"

    return jsonify({
        "success": True,
        "role": role
    })