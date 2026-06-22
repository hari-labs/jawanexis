from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
print(MONGO_URI)
print(DB_NAME)
client = MongoClient(MONGO_URI)

db = client[DB_NAME]

users_collection = db["users"]
sessions_collection = db["sessions"]
applications_collection = db["applications"]
websites_collection = db["websites"]
screenshots_collection = db["screenshots"]
activities_collection = db["activities"]
notifications_collection = db["notifications"]
audit_logs_collection = db["audit_logs"]
invitations_collection = db["invitations"]
tasks_collection = db["tasks"]
projects_collection = db["projects"]
teams_collection = db["teams"]
project_members_collection = db["project_members"]
task_evidence_collection = db["task_evidence"]
monitoring_states_collection = db["monitoring_states"]

# ── Automatically Create Indexes for Dashboard Queries ──────────────────
print("Creating database indexes for query optimization...")
try:
    # activities: employee_id + timestamp
    activities_collection.create_index([("employee_id", 1), ("timestamp", -1)])
    activities_collection.create_index([("user_id", 1), ("timestamp", -1)])

    # applications: employee_id + timestamp
    applications_collection.create_index([("employee_id", 1), ("timestamp", -1)])
    applications_collection.create_index([("user_id", 1), ("timestamp", -1)])
    applications_collection.create_index([("user_id", 1), ("start_time", -1)])

    # websites: employee_id + timestamp
    websites_collection.create_index([("employee_id", 1), ("timestamp", -1)])
    websites_collection.create_index([("user_id", 1), ("timestamp", -1)])
    websites_collection.create_index([("user_id", 1), ("start_time", -1)])

    # screenshots: employee_id + timestamp
    screenshots_collection.create_index([("employee_id", 1), ("timestamp", -1)])
    screenshots_collection.create_index([("user_id", 1), ("captured_at", -1)])

    # sessions: employee_id + start_time
    sessions_collection.create_index([("employee_id", 1), ("start_time", -1)])
    sessions_collection.create_index([("user_id", 1), ("start_time", -1)])
    print("Database indexes created successfully.")
except Exception as index_err:
    print("Error creating indexes:", index_err)