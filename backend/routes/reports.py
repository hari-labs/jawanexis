from flask import Blueprint, jsonify

reports_bp = Blueprint(
    "reports",
    __name__,
    url_prefix="/reports"
)


@reports_bp.route("/", methods=["GET"])
def get_reports():

    report = {
        "total_interns": 2,
        "active_interns": 1,
        "average_productivity": 80
    }

    return jsonify(report)