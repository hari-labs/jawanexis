from flask import Blueprint, jsonify
import json

users_bp = Blueprint(
    "users",
    __name__,
    url_prefix="/users"
)


@users_bp.route("/", methods=["GET"])
def get_users():

    with open("data/users.json", "r") as file:
        users = json.load(file)

    return jsonify(users)
