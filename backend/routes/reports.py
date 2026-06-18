from flask import Blueprint, jsonify
from collections import defaultdict

from bson import ObjectId

from utils.serializer import serialize_doc

from database.mongodb import (
    users_collection,
    sessions_collection,
    applications_collection,
    websites_collection,
    screenshots_collection
)
from config.productivity_rules import (
    PRODUCTIVE_APPS,
    DISTRACTING_APPS,
    PRODUCTIVE_SITES,
    DISTRACTING_SITES
)


reports_bp = Blueprint(
    "reports",
    __name__,
    url_prefix="/reports"
)


@reports_bp.route("/recent-activity", methods=["GET"])
def get_recent_activity():

    events = []


    # Applications

    for app in applications_collection.find():

        user = users_collection.find_one()

        events.append({

            "internId": str(user["_id"]),

            "intern": user["name"],

            "action": "Opened Application",

            "detail": app["app_name"],

            "time": app["start_time"],

            "type": "app"

        })


    # Websites

    for site in websites_collection.find():

        user = users_collection.find_one()

        events.append({

            "internId": str(user["_id"]),

            "intern": user["name"],

            "action": "Visited Website",

            "detail": site["website"],

            "time": site["start_time"],

            "type": "site"

        })


    events.sort(
        key=lambda e: e["time"],
        reverse=True
    )


    for i, event in enumerate(events):

        event["id"] = i + 1


    return jsonify(events)



@reports_bp.route("/user-summary", methods=["GET"])
def get_user_summary():

    summaries = []

    for user in users_collection.find():

        user_id = user["_id"]


        session = sessions_collection.find_one(
            {"user_id": user_id},
            sort=[("start_time", -1)]
        )


        app = applications_collection.find_one(
            {"session_id": session["_id"]},
            sort=[("start_time", -1)]
        ) if session else None


        website = websites_collection.find_one(
            {"session_id": session["_id"]},
            sort=[("start_time", -1)]
        ) if session else None


        summaries.append({

            "id": str(user["_id"]),

            "name": user["name"],

            "email": user["email"],

            "role": user["role"],


            "status":
                session["status"]
                if session else "offline",


            "workHours":
                round(
                    session["active_minutes"] / 60,
                    1
                )
                if session else 0,


            "breakHours":
                round(
                    session["idle_minutes"] / 60,
                    1
                )
                if session else 0,


            "currentApp":
                app["app_name"]
                if app else "-",


            "currentSite":
                website["website"]
                if website else "-",


            "lastActive":
                session["start_time"]
                if session else "-",


            # keep dummy for now

            "productivity": 90,

            "task": "Learning Flask",

            "avatarColor":
                "oklch(0.55 0.22 295)",

            "timezone": "IST"

        })

    return jsonify(summaries)


@reports_bp.route("/screenshots", methods=["GET"])
def get_screenshot_report():

    groups = defaultdict(list)


    for shot in screenshots_collection.find():

        hour = shot["captured_at"][11:13]

        groups[hour].append({

            "id": str(shot["_id"]),

            "hour": f"{hour}:00",

            "time": shot["captured_at"][11:16],

            "app": shot["app_name"],

            "activity": 90,

            "file_path": shot["file_path"]

        })


    result = []

    for hour, shots in groups.items():

        result.append({

            "hour": f"{hour}:00",

            "shots": shots

        })


    result.sort(
        key=lambda g: g["hour"]
    )


    return jsonify(result)


@reports_bp.route("/app-usage", methods=["GET"])
def get_app_usage():

    usage = {}

    for app in applications_collection.find():

        name = app["app_name"]

        minutes = app["duration_seconds"] // 60


        if name in PRODUCTIVE_APPS:

            category = "productive"

        elif name in DISTRACTING_APPS:

            category = "distracting"

        else:

            category = "neutral"


        if name not in usage:

            usage[name] = {

                "name": name,

                "category": category,

                "minutes": 0

            }


        usage[name]["minutes"] += minutes


    return jsonify(

        list(usage.values())

    )


@reports_bp.route("/site-usage", methods=["GET"])
def get_site_usage():

    usage = {}

    for site in websites_collection.find():

        domain = site["website"]

        minutes = site["duration_seconds"] // 60


        if domain in PRODUCTIVE_SITES:

            category = "productive"

        elif domain in DISTRACTING_SITES:

            category = "distracting"

        else:

            category = "neutral"


        if domain not in usage:

            usage[domain] = {

                "domain": domain,

                "category": category,

                "minutes": 0

            }


        usage[domain]["minutes"] += minutes


    return jsonify(

        list(usage.values())

    )