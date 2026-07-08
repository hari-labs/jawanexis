import os
import requests
from dotenv import load_dotenv

load_dotenv()

def send_invitation_email(email_address, role, activation_link):
    api_key = os.getenv("RESEND_API_KEY")
    default_sender = os.getenv("MAIL_DEFAULT_SENDER", "onboarding@resend.dev")

    if not api_key:
        print("[EMAIL] RESEND_API_KEY not configured.")
        return False, "RESEND_API_KEY not configured"

    # Derive name from email prefix
    user_name = email_address.split('@')[0].replace('.', ' ').replace('_', ' ').title()
    role_name = "Team Lead" if role == "team_lead" else "Intern"

    subject = "Workforce Monitoring System - Account Invitation"

    html_body = f"""<html>
<body>
<p>Hello {user_name},</p>
<p>You have been invited to join the Workforce Monitoring System.</p>
<p><strong>Role:</strong> {role_name}</p>
<p><strong>Activation Link:</strong> <a href="{activation_link}">{activation_link}</a></p>
<p>This invitation expires in 7 days.</p>
<br>
<p>Regards,<br>Workforce Monitoring System</p>
</body>
</html>"""

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "from": default_sender,
                "to": [email_address],
                "subject": subject,
                "html": html_body
            },
            timeout=10
        )

        if response.status_code == 200:
            print(f"[EMAIL] Invitation sent to {email_address} via Resend.")
            return True, "Success"
        else:
            error_detail = response.text
            print(f"[EMAIL] Resend API error ({response.status_code}): {error_detail}")
            return False, f"Resend API error ({response.status_code}): {error_detail}"

    except Exception as e:
        print(f"[EMAIL] Error sending email via Resend: {e}")
        return False, str(e)
