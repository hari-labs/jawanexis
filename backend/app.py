from flask import Flask
from flask_cors import CORS
from routes.users import users_bp
from routes.sessions import sessions_bp
from routes.activities import activities_bp
from routes.screenshots import screenshots_bp
from routes.reports import reports_bp
from routes.auth import auth_bp

app = Flask(__name__)

# Allow frontend to access backend
CORS(app)

# Register routes

app.register_blueprint(auth_bp)

app.register_blueprint(users_bp)

app.register_blueprint(sessions_bp)

app.register_blueprint(activities_bp)

app.register_blueprint(screenshots_bp)

app.register_blueprint(reports_bp)


@app.route("/")
def home():
    return {
        "message": "Intern Productivity Backend Running 🚀"
    }


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )