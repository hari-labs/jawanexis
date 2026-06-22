"""
Run from: d:\Intern-Workforce-Monitoring-System---JawaNexis\backend
"""
import os
from dotenv import load_dotenv
load_dotenv()

from pymongo import MongoClient
from bson import ObjectId

client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]

screenshots = db["screenshots"]
sessions = db["sessions"]
users = db["users"]
applications = db["applications"]
websites = db["websites"]

print(f"Connected to: {os.getenv('DB_NAME')}")


def resolve_uid(session_id, time_hint=None):
    sess = None
    if session_id:
        if isinstance(session_id, ObjectId):
            sess = sessions.find_one({"_id": session_id})
        elif isinstance(session_id, str) and ObjectId.is_valid(session_id):
            sess = sessions.find_one({"_id": ObjectId(session_id)})
    if not sess and time_hint:
        sess = sessions.find_one(
            {"start_time": {"$lte": time_hint}},
            sort=[("start_time", -1)]
        )
    if not sess:
        return None
    su = sess.get("user_id")
    if not su:
        return None
    if isinstance(su, ObjectId):
        return str(su)
    if isinstance(su, str) and ObjectId.is_valid(su):
        return su
    u = (users.find_one({"user_id": su}) or
         users.find_one({"user_id": str(su)}))
    return str(u["_id"]) if u else None


# Screenshots
count = 0
total = screenshots.count_documents({"user_id": {"$exists": False}})
for s in screenshots.find({"user_id": {"$exists": False}}):
    uid = resolve_uid(s.get("session_id"), s.get("captured_at"))
    if uid:
        screenshots.update_one({"_id": s["_id"]}, {"$set": {"user_id": uid}})
        count += 1
print(f"Screenshots: backfilled {count}/{total}")

# Applications
count = 0
total = applications.count_documents({"user_id": {"$exists": False}})
for a in applications.find({"user_id": {"$exists": False}}):
    uid = resolve_uid(a.get("session_id"), a.get("start_time"))
    if uid:
        applications.update_one({"_id": a["_id"]}, {"$set": {"user_id": uid}})
        count += 1
print(f"Applications: backfilled {count}/{total}")

# Websites
count = 0
total = websites.count_documents({"user_id": {"$exists": False}})
for w in websites.find({"user_id": {"$exists": False}}):
    uid = resolve_uid(w.get("session_id"), w.get("start_time"))
    if uid:
        websites.update_one({"_id": w["_id"]}, {"$set": {"user_id": uid}})
        count += 1
print(f"Websites: backfilled {count}/{total}")

print("Backfill complete.")
