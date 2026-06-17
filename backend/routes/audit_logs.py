from flask import Blueprint, request, jsonify
from database.mongodb import audit_logs_collection

audit_logs_bp = Blueprint(
    "audit_logs",
    __name__
)


@audit_logs_bp.route("/", methods=["POST"])
def create_audit_log():

    data = request.json

    result = audit_logs_collection.insert_one(data)

    return jsonify({
        "message": "Audit log created",
        "id": str(result.inserted_id)
    }), 201


@audit_logs_bp.route("/", methods=["GET"])
def get_audit_logs():

    logs = []

    for log in audit_logs_collection.find():

        log["_id"] = str(log["_id"])

        logs.append(log)

    return jsonify(logs)