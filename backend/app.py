from flask import Flask, send_from_directory
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

app = Flask(__name__)

# Allow frontend to access backend
CORS(app)

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

@app.route("/")
def home():
    return {
        "message": "Intern Productivity Backend Running 🚀"
    }


@app.route("/screenshots/<path:filename>")
def serve_screenshot(filename):

    return send_from_directory(
        "screenshots",
        filename
    )



if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )