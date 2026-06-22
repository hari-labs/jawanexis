import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

def send_invitation_email(email_address, role, activation_link):
    server = os.getenv("MAIL_SERVER")
    port_val = os.getenv("MAIL_PORT")
    username = os.getenv("MAIL_USERNAME")
    password = os.getenv("MAIL_PASSWORD")
    use_tls = os.getenv("MAIL_USE_TLS", "False").lower() in ("true", "1", "yes")
    use_ssl = os.getenv("MAIL_USE_SSL", "False").lower() in ("true", "1", "yes")
    default_sender = os.getenv("MAIL_DEFAULT_SENDER", username)

    if not server or not port_val:
        print("[SMTP] Mail configuration missing server or port.")
        return False, "SMTP configuration missing server or port"

    try:
        port = int(port_val)
    except ValueError:
        return False, "Invalid port value"

    # Derive name from email prefix
    user_name = email_address.split('@')[0].replace('.', ' ').replace('_', ' ').title()
    role_name = "Team Lead" if role == "team_lead" else "Intern"

    subject = "Workforce Monitoring System - Account Invitation"
    
    # HTML template matching the requirement exactly
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

    # Plain text version for fallback
    text_body = f"""Hello {user_name},

You have been invited to join the Workforce Monitoring System.

Role:
{role_name}

Activation Link:
{activation_link}

This invitation expires in 7 days.

Regards,
Workforce Monitoring System"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = default_sender
    msg["To"] = email_address

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        if use_ssl:
            smtp = smtplib.SMTP_SSL(server, port, timeout=10)
        else:
            smtp = smtplib.SMTP(server, port, timeout=10)
            
        if use_tls:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()

        if username and password:
            smtp.login(username, password)

        smtp.sendmail(default_sender, email_address, msg.as_string())
        smtp.quit()
        return True, "Success"
    except Exception as e:
        print("[SMTP] Error sending email:", e)
        return False, str(e)
