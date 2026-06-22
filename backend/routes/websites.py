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
    data = dict(request.json or {})
    
    domain = data.get("domain") or data.get("website") or "Unknown"
    title = data.get("title") or data.get("page_title") or ""
    dur = data.get("duration_seconds") or data.get("duration") or 0
    try:
        dur = int(dur)
    except (ValueError, TypeError):
        dur = 0
        
    data["domain"] = domain
    data["website"] = domain
    data["title"] = title
    data["page_title"] = title
    data["duration_seconds"] = dur
    
    from utils.serializer import populate_user_details
    populate_user_details(data)

    result = websites_collection.insert_one(data)

    return jsonify({
        "message": "Website created",
        "id": str(result.inserted_id)
    }), 201