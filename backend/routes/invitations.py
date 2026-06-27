import uuid
from flask import Blueprint, request, jsonify
from database.mongodb import invitations_collection, users_collection
from bson import ObjectId
from datetime import datetime
from werkzeug.security import generate_password_hash
from utils.serializer import serialize_doc
import os

invitations_bp = Blueprint(
    "invitations",
    __name__,
    url_prefix="/invitations"
)

def check_invitation_validity(invitation):
    if not invitation:
        return False, "Invalid or expired invitation token"
    if invitation.get("status") == "activated":
        return False, "Invitation Already Activated"
    
    created_at_str = invitation.get("created_at")
    if created_at_str:
        try:
            created_at = datetime.fromisoformat(created_at_str)
            now = datetime.utcnow()
            if created_at.tzinfo is None:
                now = now.replace(tzinfo=None)
            if (now - created_at).days >= 7:
                return False, "Invitation Expired"
        except Exception:
            pass
            
    return True, None


@invitations_bp.route("/", methods=["POST"])
def create_invitation():
    data = request.json
    email = data.get("email")
    role = data.get("role", "intern")
    invited_by = data.get("invited_by", "admin")

    if not email:
        return jsonify({"success": False, "message": "Email is required"}), 400

    # Check if user already exists
    if users_collection.find_one({"email": email}):
        return jsonify({"success": False, "message": "User with this email already exists"}), 400

    token = str(uuid.uuid4())
    invitation = {
        "email": email,
        "role": role,
        "token": token,
        "status": "pending",
        "invited_by": invited_by,
        "created_at": datetime.utcnow().isoformat(),
        "email_sent": False,
        "email_sent_at": None,
        "delivery_status": "pending"
    }

    # Generate activation link
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    link = f"{frontend_url}/activate?token={token}"
    
    # Send email automatically via mailer
    from utils.mailer import send_invitation_email
    success, err_msg = send_invitation_email(email, role, link)

    if success:
        invitation["email_sent"] = True
        invitation["email_sent_at"] = datetime.utcnow().isoformat()
        invitation["delivery_status"] = "success"
    else:
        invitation["email_sent"] = False
        invitation["delivery_status"] = "failed"
        invitation["email_error"] = err_msg

    result = invitations_collection.insert_one(invitation)

    if success:
        return jsonify({
            "success": True,
            "message": "Invitation created",
            "id": str(result.inserted_id),
            "token": token,
            "link": link
        }), 201
    else:
        return jsonify({
            "success": True, # Still created successfully
            "message": "Invitation created but email delivery failed.",
            "id": str(result.inserted_id),
            "token": token,
            "link": link
        }), 201


@invitations_bp.route("/", methods=["GET"])
def get_invitations():
    invitations = []
    for invitation in invitations_collection.find().sort("created_at", -1):
        invitations.append(serialize_doc(invitation))
    return jsonify(invitations)


@invitations_bp.route("/resend", methods=["POST"])
def resend_invitation():
    data = request.json
    token = data.get("token")

    if not token:
        return jsonify({"success": False, "message": "Token is required"}), 400

    invitation = invitations_collection.find_one({"token": token})
    if not invitation:
        return jsonify({"success": False, "message": "Invitation not found"}), 404

    if invitation.get("status") == "activated":
        return jsonify({"success": False, "message": "Invitation Already Activated"}), 400

    # Renew the expiration time
    created_at_now = datetime.utcnow().isoformat()
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    link = f"{frontend_url}/activate?token={token}"

    from utils.mailer import send_invitation_email
    success, err_msg = send_invitation_email(invitation["email"], invitation["role"], link)

    update_fields = {
        "created_at": created_at_now
    }
    if success:
        update_fields["email_sent"] = True
        update_fields["email_sent_at"] = datetime.utcnow().isoformat()
        update_fields["delivery_status"] = "success"
        update_fields["email_error"] = None
    else:
        update_fields["email_sent"] = False
        update_fields["delivery_status"] = "failed"
        update_fields["email_error"] = err_msg

    invitations_collection.update_one(
        {"_id": invitation["_id"]},
        {"$set": update_fields}
    )

    if success:
        return jsonify({
            "success": True,
            "message": "Invitation email resent successfully",
            "link": link
        })
    else:
        return jsonify({
            "success": False,
            "message": f"Resend failed: {err_msg}",
            "link": link
        }), 500


@invitations_bp.route("/validate/<token>", methods=["GET"])
def validate_invitation(token):
    invitation = invitations_collection.find_one({"token": token})
    if not invitation:
        return jsonify({"success": False, "message": "Invalid or expired invitation token"}), 404
        
    is_valid, err_msg = check_invitation_validity(invitation)
    if not is_valid:
        return jsonify({"success": False, "message": err_msg}), 400

    return jsonify({
        "success": True,
        "email": invitation["email"],
        "role": invitation["role"]
    })


@invitations_bp.route("/activate", methods=["POST"])
def activate_invitation():
    data = request.json
    token = data.get("token")
    name = data.get("name")
    password = data.get("password")

    if not token or not name or not password:
        return jsonify({"success": False, "message": "All fields are required"}), 400

    invitation = invitations_collection.find_one({"token": token})
    if not invitation:
        return jsonify({"success": False, "message": "Invalid or expired invitation token"}), 404

    is_valid, err_msg = check_invitation_validity(invitation)
    if not is_valid:
        return jsonify({"success": False, "message": err_msg}), 400

    # Double check if user exists
    if users_collection.find_one({"email": invitation["email"]}):
        return jsonify({"success": False, "message": "User already registered"}), 400

    # Auto-increment user_id for sync compatibility
    max_user = list(users_collection.find().sort("user_id", -1).limit(1))
    next_user_id = (max_user[0].get("user_id", 0) + 1) if max_user else 1

    user_doc = {
        "name": name,
        "email": invitation["email"],
        "password_hash": generate_password_hash(password),
        "role": invitation["role"],
        "is_active": True,
        "user_id": next_user_id,
        "invited_by": invitation.get("invited_by"),
        "activated_at": datetime.utcnow().isoformat(),
        "created_at": datetime.utcnow().isoformat()
    }
    
    users_collection.insert_one(user_doc)
    invitations_collection.update_one(
        {"_id": invitation["_id"]},
        {"$set": {"status": "activated", "activated_at": datetime.utcnow().isoformat()}}
    )

    return jsonify({"success": True, "message": "Account activated successfully"})