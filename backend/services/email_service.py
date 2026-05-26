# Email Notification Service using Gmail SMTP
# Matches file: backend/services/email_service.py

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from config import Config

def send_html_email(to_email, subject, html_content):
    """
    Sends an HTML email using Gmail SMTP and the configured app password.
    """
    if not Config.GMAIL_USER or not Config.GMAIL_APP_PASSWORD:
        print("Email Service Warning: GMAIL_USER or GMAIL_APP_PASSWORD not set. Email not sent.")
        return False
        
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Task Manager <{Config.GMAIL_USER}>"
        msg['To'] = to_email
        
        part = MIMEText(html_content, 'html')
        msg.attach(part)
        
        # Connect to Gmail SMTP
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()  # Upgrade connection to secure TLS
        server.login(Config.GMAIL_USER, Config.GMAIL_APP_PASSWORD)
        server.sendmail(Config.GMAIL_USER, to_email, msg.as_string())
        server.quit()
        
        print(f"Email successfully sent to {to_email} with subject: '{subject}'")
        return True
    except Exception as e:
        print(f"Email Service Error: Failed to send email to {to_email}. Error: {e}")
        return False

def send_task_created_email(assignee_email, assignee_name, creator_name, creator_email, task_title, task_description):
    """
    Sends a notification email to the assignee when a new task is assigned to them.
    """
    subject = f"New Task Assigned: {task_title}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #f9fafb;
                margin: 0;
                padding: 0;
                color: #1f2937;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 12px;
                border: 1px solid #e5e7eb;
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            }}
            .header {{
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                padding: 30px;
                text-align: center;
                color: white;
            }}
            .header h1 {{
                margin: 0;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: -0.025em;
            }}
            .content {{
                padding: 30px;
                line-height: 1.6;
            }}
            .greeting {{
                font-size: 18px;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 16px;
            }}
            .info-box {{
                background-color: #f3f4f6;
                border-left: 4px solid #4f46e5;
                padding: 20px;
                border-radius: 0 8px 8px 0;
                margin: 24px 0;
            }}
            .task-title {{
                font-size: 18px;
                font-weight: 700;
                margin-top: 0;
                margin-bottom: 8px;
                color: #111827;
            }}
            .task-desc {{
                font-size: 14px;
                color: #4b5563;
                margin: 0;
            }}
            .meta {{
                font-size: 13px;
                color: #6b7280;
                margin-top: 16px;
                border-top: 1px solid #e5e7eb;
                padding-top: 12px;
            }}
            .footer {{
                background-color: #f9fafb;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #9ca3af;
                border-top: 1px solid #e5e7eb;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Task Management Notification</h1>
            </div>
            <div class="content">
                <p class="greeting">Hello {assignee_name or 'Team Member'},</p>
                <p>You have been assigned a new task by <strong>{creator_name or creator_email}</strong>.</p>
                
                <div class="info-box">
                    <div class="task-title">{task_title}</div>
                    <p class="task-desc">{task_description or "No description provided."}</p>
                </div>
                
                <p class="meta">
                    <strong>Assigned by:</strong> {creator_name} ({creator_email})
                </p>
            </div>
            <div class="footer">
                This is an automated notification from the Task Management System.<br>
                Please do not reply directly to this email.
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_html_email(assignee_email, subject, html_content)

def send_task_completed_email(creator_email, creator_name, assignee_name, assignee_email, task_title):
    """
    Sends a notification email to the task creator when a task is completed.
    """
    subject = f"Task Completed: {task_title}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #f9fafb;
                margin: 0;
                padding: 0;
                color: #1f2937;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 12px;
                border: 1px solid #e5e7eb;
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            }}
            .header {{
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                padding: 30px;
                text-align: center;
                color: white;
            }}
            .header h1 {{
                margin: 0;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: -0.025em;
            }}
            .content {{
                padding: 30px;
                line-height: 1.6;
            }}
            .greeting {{
                font-size: 18px;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 16px;
            }}
            .info-box {{
                background-color: #ecfdf5;
                border-left: 4px solid #10b981;
                padding: 20px;
                border-radius: 0 8px 8px 0;
                margin: 24px 0;
            }}
            .task-title {{
                font-size: 18px;
                font-weight: 700;
                margin-top: 0;
                margin-bottom: 8px;
                color: #065f46;
                text-decoration: line-through;
            }}
            .status-badge {{
                display: inline-block;
                background-color: #d1fae5;
                color: #065f46;
                font-size: 12px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 9999px;
                text-transform: uppercase;
                margin-top: 4px;
            }}
            .meta {{
                font-size: 13px;
                color: #6b7280;
                margin-top: 16px;
                border-top: 1px solid #e5e7eb;
                padding-top: 12px;
            }}
            .footer {{
                background-color: #f9fafb;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #9ca3af;
                border-top: 1px solid #e5e7eb;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Task Completed</h1>
            </div>
            <div class="content">
                <p class="greeting">Hello {creator_name or 'Task Creator'},</p>
                <p>A task you created has been marked as <strong>Completed</strong> by <strong>{assignee_name or assignee_email}</strong>.</p>
                
                <div class="info-box">
                    <div class="task-title">{task_title}</div>
                    <span class="status-badge">Completed</span>
                </div>
                
                <p class="meta">
                    <strong>Completed by:</strong> {assignee_name} ({assignee_email})
                </p>
            </div>
            <div class="footer">
                This is an automated notification from the Task Management System.<br>
                Please do not reply directly to this email.
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_html_email(creator_email, subject, html_content)
