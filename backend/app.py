import os
from flask import Flask, send_from_directory, g, request, has_app_context
from flask_cors import CORS
from routes.users import users_bp
from routes.sessions import sessions_bp
from routes.applications import applications_bp
from routes.websites import websites_bp
from routes.screenshots import screenshots_bp
from routes.reports import reports_bp
from routes.auth import auth_bp
from routes.activities import activities_bp
from routes.notifications import notifications_bp
from routes.audit_logs import audit_logs_bp
from routes.invitations import invitations_bp
from routes.tasks import tasks_bp
from routes.projects import projects_bp
from routes.teams import teams_bp
import time
from pymongo.collection import Collection

app = Flask(__name__)

# Allow frontend to access backend
frontend_url = os.environ.get(
    "FRONTEND_URL",
    "http://localhost:5173"
)

CORS(
    app,
    resources={
        r"/*": {
            "origins": [
                frontend_url,
                "http://localhost:5173"
            ]
        }
    },
    supports_credentials=True
)

# Wrap pymongo collection methods to measure database query time
original_collection_methods = {}
for method_name in ['find', 'find_one', 'insert_one', 'update_one', 'delete_one', 'delete_many', 'count_documents', 'aggregate']:
    if hasattr(Collection, method_name):
        original_collection_methods[method_name] = getattr(Collection, method_name)

def make_wrapped_pymongo_method(name, orig):
    def wrapped(self, *args, **kwargs):
        if not has_app_context():
            return orig(self, *args, **kwargs)
        start = time.perf_counter()
        res = orig(self, *args, **kwargs)
        duration = (time.perf_counter() - start) * 1000  # ms
        if 'query_time' not in g:
            g.query_time = 0.0
        g.query_time += duration
        return res
    return wrapped

for name, orig in original_collection_methods.items():
    setattr(Collection, name, make_wrapped_pymongo_method(name, orig))

@app.before_request
def start_request_timer():
    g.start_time = time.perf_counter()
    g.query_time = 0.0

@app.after_request
def log_request_performance(response):
    if hasattr(g, 'start_time'):
        elapsed = (time.perf_counter() - g.start_time) * 1000  # ms
        query_time = g.get('query_time', 0.0)
        print(f"[TIMING] Endpoint: {request.path} | Method: {request.method} | Execution Time: {elapsed:.2f}ms | Query Time: {query_time:.2f}ms")
    return response

# Register routes

app.register_blueprint(auth_bp)

app.register_blueprint(users_bp)

app.register_blueprint(sessions_bp)

app.register_blueprint(applications_bp)

app.register_blueprint(websites_bp)

app.register_blueprint(screenshots_bp)

app.register_blueprint(reports_bp)

app.register_blueprint(
    activities_bp,
    url_prefix="/activities"
)

app.register_blueprint(
    notifications_bp,
    url_prefix="/notifications"
)

app.register_blueprint(
    audit_logs_bp,
    url_prefix="/audit_logs"
)

app.register_blueprint(
    invitations_bp,
    url_prefix="/invitations"
)

app.register_blueprint(
    tasks_bp,
    url_prefix="/tasks"
)

app.register_blueprint(projects_bp)
app.register_blueprint(teams_bp)

from routes.monitoring import monitoring_bp
app.register_blueprint(monitoring_bp)

@app.route("/")
def home():
    return {
        "message": "Intern Productivity Backend Running 🚀"
    }


@app.route("/screenshots/<path:filename>")
def serve_screenshot(filename):
    import os
    from flask import redirect
    from database.mongodb import screenshots_collection
    # Strip any duplicate folder prefixes or directory traversal
    if filename.startswith("screenshots/"):
        filename = filename[len("screenshots/"):]
    basename = os.path.basename(filename)

    # Check MongoDB to see if we have this screenshot uploaded to Cloudinary
    try:
        shot = screenshots_collection.find_one({"file_basename": basename})
        if not shot:
            shot = screenshots_collection.find_one({
                "$or": [
                    {"file_path": {"$regex": basename}},
                    {"cloudinary_url": {"$regex": basename}}
                ]
            })
        if shot and shot.get("uploaded_to_cloud") and shot.get("cloudinary_url"):
            return redirect(shot.get("cloudinary_url"))
    except Exception as e:
        print(f"Error querying screenshot {basename} for Cloudinary redirect: {e}")

    return send_from_directory("screenshots", basename)


@app.route("/evidence/<path:filename>")
def serve_evidence(filename):

    return send_from_directory(
        "evidence",
        filename
    )



def migrate_existing_users():
    try:
        from database.mongodb import users_collection
        from werkzeug.security import generate_password_hash
        print("Running password migration for legacy users...")
        migrated_count = 0
        for user in users_collection.find():
            plaintext_pwd = user.get("password")
            if plaintext_pwd:
                pwd_hash = generate_password_hash(plaintext_pwd)
                users_collection.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {"password_hash": pwd_hash},
                        "$unset": {"password": ""}
                    }
                )
                migrated_count += 1
        print(f"Migration completed. Migrated {migrated_count} users.")
    except Exception as e:
        print("Error running user migration:", e)


if __name__ == "__main__":
    migrate_existing_users()
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )