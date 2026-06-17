from datetime import datetime, UTC

from database.mongodb import (
    users_collection,
    sessions_collection,
    applications_collection,
    websites_collection,
    screenshots_collection
)


# ---------- User ----------

user_result = users_collection.insert_one({

    "name": "Hari",

    "email": "hari@gmail.com",

    "password": "123456",

    "role": "intern",

    "created_at": datetime.now(UTC).isoformat()

})

user_id = user_result.inserted_id

print("User ID:", user_id)



# ---------- Session ----------

session_result = sessions_collection.insert_one({

    "user_id": user_id,

    "employee_id": "INT001",

    "device_id": "DESKTOP-001",

    "start_time":
        "2026-06-15T09:00:00+00:00",

    "end_time": None,

    "status": "active",

    "active_minutes": 15,

    "idle_minutes": 0,

    "created_at":
        datetime.now(
            UTC
        ).isoformat()

})

session_id = session_result.inserted_id

print("Session ID:", session_id)



# ---------- Application 1 ----------

applications_collection.insert_one({

    "session_id": session_id,

    "app_name": "VS Code",

    "window_title": "app.py",

    "start_time": "2026-06-15T09:00:00+00:00",

    "end_time": "2026-06-15T09:15:00+00:00",

    "duration_seconds": 900,

    "created_at": datetime.now(UTC).isoformat()

})



# ---------- Application 2 ----------

applications_collection.insert_one({

    "session_id": session_id,

    "app_name": "Chrome",

    "window_title": "ChatGPT",

    "start_time": "2026-06-15T09:15:00+00:00",

    "productivity_type": "productive",

    "end_time": None,

    "duration_seconds": 0,

    "created_at": datetime.now(UTC).isoformat()

})



# ---------- Website ----------

websites_collection.insert_one({

    "session_id": session_id,

    "website": "chatgpt.com",

    "page_title": "ChatGPT",

    "start_time": "2026-06-15T09:15:00+00:00",

    "end_time": None,

    "duration_seconds": 0,

    "created_at": datetime.now(UTC).isoformat(),

    "productivity_type": "productive"

})



# ---------- Screenshot ----------

screenshots_collection.insert_one({

    "session_id": session_id,

    "file_path": "screenshots/20260615_091500.png",

    "captured_at": "2026-06-15T09:15:00+00:00",

    "app_name": "Chrome"

})


print("Dummy data inserted successfully.")