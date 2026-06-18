from flask import Blueprint, request, jsonify
from database.mongodb import invitations_collection

from bson import ObjectId
from utils.serializer import serialize_doc

invitations_bp = Blueprint(
    "invitations",
    __name__
)


@invitations_bp.route("/", methods=["POST"])
def create_invitation():

    data = request.json

    result = invitations_collection.insert_one(data)

    return jsonify({
        "message": "Invitation created",
        "id": str(result.inserted_id)
    }), 201


@invitations_bp.route("/", methods=["GET"])
def get_invitations():

    invitations = []

    for invitation in invitations_collection.find():

        invitation["_id"] = str(
            invitation["_id"]
        )

        invitations.append(invitation)

    return jsonify(invitations)