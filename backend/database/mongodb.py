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
audit_logs_collection = db["audit_logs"]
invitations_collection = db["invitations"]