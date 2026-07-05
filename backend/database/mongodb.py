import os
import logging
import threading
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
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
daily_summaries_collection = db["daily_summaries"]
devices_collection = db["devices"]

# ── Automatically Create Indexes for Dashboard Queries ──────────────────

def create_indexes_async():
    import time
    time.sleep(1)  # Minimal startup delay
    
    def _ensure_index(collection, key_or_list, **kwargs):
        if isinstance(key_or_list, str):
            expected_key = [(key_or_list, 1)]
        else:
            expected_key = key_or_list
        try:
            existing = collection.index_information()
        except Exception:
            existing = {}
        for idx_info in existing.values():
            if idx_info.get("key") == expected_key:
                return
        try:
            collection.create_index(key_or_list, **kwargs)
        except Exception:
            logging.exception(
                f"Index creation failed for {collection.name}"
            )

    try:
        # activities
        _ensure_index(activities_collection, "employee_id")
        _ensure_index(activities_collection, "session_id")
        _ensure_index(activities_collection, "timestamp")
        _ensure_index(activities_collection, "user_id")
        _ensure_index(activities_collection, [("employee_id", 1), ("timestamp", -1)])
        _ensure_index(activities_collection, [("user_id", 1), ("timestamp", -1)])

        # applications
        _ensure_index(applications_collection, "employee_id")
        _ensure_index(applications_collection, "session_id")
        _ensure_index(applications_collection, "timestamp")
        _ensure_index(applications_collection, "user_id")
        _ensure_index(applications_collection, [("employee_id", 1), ("timestamp", -1)])
        _ensure_index(applications_collection, [("user_id", 1), ("timestamp", -1)])
        _ensure_index(applications_collection, [("user_id", 1), ("start_time", -1)])

        # websites
        _ensure_index(websites_collection, "employee_id")
        _ensure_index(websites_collection, "session_id")
        _ensure_index(websites_collection, "timestamp")
        _ensure_index(websites_collection, "user_id")
        _ensure_index(websites_collection, [("employee_id", 1), ("timestamp", -1)])
        _ensure_index(websites_collection, [("user_id", 1), ("timestamp", -1)])
        _ensure_index(websites_collection, [("user_id", 1), ("start_time", -1)])

        # screenshots
        _ensure_index(screenshots_collection, "employee_id")
        _ensure_index(screenshots_collection, "session_id")
        _ensure_index(screenshots_collection, "timestamp")
        _ensure_index(screenshots_collection, "user_id")
        _ensure_index(screenshots_collection, "captured_at")
        _ensure_index(screenshots_collection, "file_basename")
        _ensure_index(screenshots_collection, [("employee_id", 1), ("timestamp", -1)])
        _ensure_index(screenshots_collection, [("user_id", 1), ("captured_at", -1)])

        # sessions
        _ensure_index(sessions_collection, "employee_id")
        _ensure_index(sessions_collection, "start_time")
        _ensure_index(sessions_collection, "user_id")
        _ensure_index(sessions_collection, [("employee_id", 1), ("start_time", -1)])
        _ensure_index(sessions_collection, [("user_id", 1), ("start_time", -1)])

        # tasks
        _ensure_index(tasks_collection, "assigned_to")
        _ensure_index(tasks_collection, "project_id")
        _ensure_index(tasks_collection, "created_at")

        # projects
        _ensure_index(projects_collection, "lead_id")
        _ensure_index(projects_collection, "member_ids")

        # audit_logs
        _ensure_index(audit_logs_collection, "user_id")
        _ensure_index(audit_logs_collection, "timestamp")
        _ensure_index(audit_logs_collection, "action")
        _ensure_index(audit_logs_collection, [("user_id", 1), ("timestamp", -1)])

        # daily_summaries
        _ensure_index(daily_summaries_collection, [("user_id", 1), ("date", 1)], unique=True)

        # devices
        _ensure_index(devices_collection, "device_uuid", unique=True)
        
        # monitoring_states
        _ensure_index(monitoring_states_collection, "user_id")

    except Exception as index_err:
        print("Error creating indexes:", index_err)

threading.Thread(target=create_indexes_async, daemon=True).start()