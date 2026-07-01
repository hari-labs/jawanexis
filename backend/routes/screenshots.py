from flask import Blueprint, jsonify, request
from database.mongodb import screenshots_collection, sessions_collection, users_collection
from bson import ObjectId
from utils.serializer import serialize_doc

screenshots_bp = Blueprint(
    "screenshots",
    __name__,
    url_prefix="/screenshots"
)


@screenshots_bp.route("/", methods=["GET"])
def get_screenshots():
    import os
    user_id = request.args.get("user_id")
    query = {}
    if user_id:
        query["user_id"] = user_id
    shots = []
    for s in screenshots_collection.find(query).sort("captured_at", -1):
        doc = serialize_doc(s)
        if doc.get("file_path"):
            doc["file_path"] = "screenshots/" + os.path.basename(doc["file_path"])
        shots.append(doc)
    return jsonify(shots)


@screenshots_bp.route("/", methods=["POST"])
def create_screenshot():
    import os
    if request.files:
        file = request.files.get("file")
        if not file:
            return jsonify({"error": "No file uploaded"}), 400

        os.makedirs("screenshots", exist_ok=True)
        filename = file.filename
        file_path = os.path.join("screenshots", filename)
        file.save(file_path)

        data = {
            "session_id": request.form.get("session_id"),
            "captured_at": request.form.get("captured_at"),
            "file_path": f"screenshots/{filename}",
            "file_basename": filename,
            "user_id": request.form.get("user_id") or request.form.get("employee_id")
        }

        # Store session_id as ObjectId if possible, else string
        raw_sid = data["session_id"]
        if raw_sid and ObjectId.is_valid(raw_sid):
            data["session_id"] = raw_sid  # keep as string for portability
        else:
            try:
                data["session_id"] = int(raw_sid)
            except (ValueError, TypeError):
                pass

        # Store optional app metadata
        if request.form.get("app_name"):
            data["app_name"] = request.form.get("app_name")
        if request.form.get("window_title"):
            data["window_title"] = request.form.get("window_title")
        if request.form.get("activity"):
            try:
                data["activity"] = int(request.form.get("activity"))
            except (ValueError, TypeError):
                pass
    else:
        data = dict(request.json or {})

    # ── Resolve user_id from session_id ────────────────────────────────────
    # Store user_id directly on screenshot so ownership queries are fast/reliable
    resolved_user_id = data.get("user_id")
    if not resolved_user_id:
        sid = data.get("session_id")
        if sid:
            sess = None
            if isinstance(sid, str) and ObjectId.is_valid(sid):
                sess = sessions_collection.find_one({"_id": ObjectId(sid)})
            elif isinstance(sid, ObjectId):
                sess = sessions_collection.find_one({"_id": sid})
            if not sess:
                # Integer sid: find session by user_id from monitoring context
                # Fallback: look up using captured_at timestamp
                captured = data.get("captured_at")
                if captured:
                    sess = sessions_collection.find_one(
                        {"start_time": {"$lte": captured}},
                        sort=[("start_time", -1)]
                    )
            if sess:
                sess_uid = sess.get("user_id")
                if sess_uid:
                    if isinstance(sess_uid, ObjectId):
                        resolved_user_id = str(sess_uid)
                    else:
                        # Legacy: integer user_id — look up user by it
                        user = users_collection.find_one({"user_id": sess_uid}) or \
                               users_collection.find_one({"user_id": str(sess_uid)}) or \
                               users_collection.find_one({"_id": ObjectId(sess_uid) if ObjectId.is_valid(str(sess_uid)) else sess_uid})
                        if user:
                            resolved_user_id = str(user["_id"])
                        else:
                            resolved_user_id = str(sess_uid)

    if resolved_user_id:
        data["user_id"] = resolved_user_id

    # Also populate email/role from user
    if resolved_user_id:
        user = users_collection.find_one({"_id": ObjectId(resolved_user_id) if ObjectId.is_valid(resolved_user_id) else resolved_user_id})
        if user:
            data["email"] = user.get("email")
            data["role"] = user.get("role", "intern")

    # Ensure employee_id and timestamp are populated for schema compatibility
    if "employee_id" not in data or not data["employee_id"]:
        data["employee_id"] = data.get("user_id")
    if "timestamp" not in data or not data["timestamp"]:
        data["timestamp"] = data.get("captured_at")

    # ── Cloudinary Upload ──────────────────────────────────────────────────
    uploaded_to_cloud = False
    cloudinary_url = None
    cloudinary_public_id = None

    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME")
    api_key = os.environ.get("CLOUDINARY_API_KEY")
    api_secret = os.environ.get("CLOUDINARY_API_SECRET")

    is_configured = (
        cloud_name and cloud_name != "your_cloud_name" and
        api_key and api_key != "your_api_key" and
        api_secret and api_secret != "your_api_secret"
    )

    # Resolve local file path
    fp = data.get("file_path")
    local_fp = None
    if fp:
        if os.path.exists(fp):
            local_fp = fp
        else:
            basename = os.path.basename(fp)
            candidate = os.path.join("screenshots", basename)
            if os.path.exists(candidate):
                local_fp = candidate

    if is_configured and local_fp:
        from utils.cloudinary_helper import upload_to_cloudinary
        try:
            success, secure_url, public_id = upload_to_cloudinary(
                local_fp, cloud_name, api_key, api_secret
            )
            if success:
                uploaded_to_cloud = True
                cloudinary_url = secure_url
                cloudinary_public_id = public_id
            else:
                print(f"Cloudinary upload failed: {secure_url}")
        except Exception as e:
            print(f"Cloudinary upload exception: {e}")

    data["uploaded_to_cloud"] = uploaded_to_cloud
    data["cloudinary_url"] = cloudinary_url
    data["cloudinary_public_id"] = cloudinary_public_id

    # Check if a screenshot with the same session_id and captured_at already exists
    existing = None
    if data.get("session_id") and data.get("captured_at"):
        existing = screenshots_collection.find_one({
            "session_id": data["session_id"],
            "captured_at": data["captured_at"]
        })

    if existing:
        if existing.get("uploaded_to_cloud") and existing.get("cloudinary_url"):
            # Already uploaded successfully, return existing details
            return jsonify({
                "message": "Screenshot created",
                "id": str(existing["_id"]),
                "uploaded_to_cloud": True,
                "cloudinary_url": existing.get("cloudinary_url")
            }), 201
        
        # Otherwise, update the existing record with the new upload details
        screenshots_collection.update_one({"_id": existing["_id"]}, {"$set": data})
        inserted_id = existing["_id"]
    else:
        result = screenshots_collection.insert_one(data)
        inserted_id = result.inserted_id

    # Trigger screenshot notification
    if inserted_id and data.get("user_id"):
        try:
            from routes.notifications import create_notification_internal
            create_notification_internal(
                data["user_id"],
                "Screenshot Uploaded",
                "A desktop screenshot has been successfully captured and uploaded to the cloud.",
                "screenshot_uploaded"
            )
        except Exception as e:
            print("Failed to trigger screenshot notification:", e)

    # Automatic Local Cleanup
    if uploaded_to_cloud and inserted_id and local_fp:
        try:
            if os.path.exists(local_fp):
                os.remove(local_fp)
                print(f"Successfully deleted local screenshot file: {local_fp}")
        except Exception as e:
            print(f"Failed to delete local file {local_fp}: {e}")

    return jsonify({
        "message": "Screenshot created",
        "id": str(inserted_id),
        "uploaded_to_cloud": uploaded_to_cloud,
        "cloudinary_url": cloudinary_url
    }), 201