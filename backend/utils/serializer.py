from bson import ObjectId


def serialize_doc(doc):
    if not doc:
        return doc
    for field in ["password", "password_hash"]:
        if field in doc:
            del doc[field]
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            doc[key] = str(value)
    return doc

def populate_user_details(doc):
    if not doc:
        return doc
        
    session_id = doc.get("session_id")
    if not session_id:
        return doc
        
    from database.mongodb import sessions_collection, users_collection
    from bson import ObjectId
    
    try:
        sess = sessions_collection.find_one({"_id": ObjectId(session_id) if ObjectId.is_valid(session_id) else session_id})
        if sess:
            user_id = sess.get("user_id")
            if user_id:
                user = users_collection.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
                if user:
                    doc["user_id"] = str(user["_id"])
                    doc["email"] = user.get("email")
                    doc["role"] = user.get("role", "intern")
    except Exception:
        pass
        
    return doc