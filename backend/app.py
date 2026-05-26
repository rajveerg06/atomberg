# Flask REST API Server
# Matches file: backend/app.py

import os
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from supabase import create_client, Client
from config import Config
from auth import require_auth
from services.email_service import send_task_created_email, send_task_completed_email

# Validate config
Config.validate()

# Initialize Flask app
app = Flask(__name__)

# Configure CORS to allow frontend calls
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# Initialize Supabase client with Service Role Key (admin privileges)
supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_KEY)

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy"}), 200

@app.route("/api/users", methods=["GET"])
@require_auth
def get_users():
    """
    Fetches all registered users' profiles.
    Used for task assignee dropdown.
    """
    try:
        response = supabase.table("profiles").select("id, email, full_name, avatar_url").execute()
        return jsonify(response.data), 200
    except Exception as e:
        print(f"Error fetching users: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/tasks", methods=["GET"])
@require_auth
def get_tasks():
    """
    Fetches all tasks. Includes creator and assignee profiles.
    """
    try:
        # Try relationship join query (Postgrest handles joining via foreign keys)
        response = supabase.table("tasks")\
            .select("*, creator:profiles!creator_id(id, email, full_name, avatar_url), assignee:profiles!assignee_id(id, email, full_name, avatar_url)")\
            .order("created_at", desc=True)\
            .execute()
        tasks = response.data
    except Exception as e:
        print(f"Relationship join query failed, falling back to manual merge. Error: {e}")
        try:
            # Fallback: Fetch tasks and profiles separately and merge in Python
            tasks_res = supabase.table("tasks").select("*").order("created_at", desc=True).execute()
            tasks = tasks_res.data
            
            profiles_res = supabase.table("profiles").select("id, email, full_name, avatar_url").execute()
            profiles_map = {p["id"]: p for p in profiles_res.data}
            
            for task in tasks:
                task["creator"] = profiles_map.get(task["creator_id"])
                task["assignee"] = profiles_map.get(task["assignee_id"])
        except Exception as fallback_err:
            print(f"Fallback query failed: {fallback_err}")
            return jsonify({"error": str(fallback_err)}), 500

    return jsonify(tasks), 200

@app.route("/api/tasks", methods=["POST"])
@require_auth
def create_task():
    """
    Creates a new task. Sends an email to the assignee if assigned to someone else.
    """
    data = request.json
    if not data or not data.get("title"):
        return jsonify({"error": "Title is required"}), 400
        
    title = data.get("title")
    description = data.get("description", "")
    assignee_id = data.get("assignee_id")  # Can be None/null
    
    # Task data for insert
    task_data = {
        "title": title,
        "description": description,
        "creator_id": g.user_id,
        "assignee_id": assignee_id,
        "status": "pending"
    }
    
    try:
        # Insert task into Supabase
        response = supabase.table("tasks").insert(task_data).execute()
        if not response.data:
            return jsonify({"error": "Failed to create task in database"}), 500
            
        created_task = response.data[0]
        
        # Populate creator and assignee details for response
        creator_profile = supabase.table("profiles").select("*").eq("id", g.user_id).execute().data
        created_task["creator"] = creator_profile[0] if creator_profile else None
        
        assignee_profile = None
        if assignee_id:
            assignee_res = supabase.table("profiles").select("*").eq("id", assignee_id).execute().data
            assignee_profile = assignee_res[0] if assignee_res else None
            created_task["assignee"] = assignee_profile
            
        # Send Email Notification to Assignee (only if assigned to someone else)
        if assignee_profile and assignee_id != g.user_id:
            creator_name = created_task["creator"].get("full_name") if created_task["creator"] else g.user_email
            send_task_created_email(
                assignee_email=assignee_profile.get("email"),
                assignee_name=assignee_profile.get("full_name"),
                creator_name=creator_name,
                creator_email=g.user_email,
                task_title=title,
                task_description=description
            )
            
        return jsonify(created_task), 201
        
    except Exception as e:
        print(f"Error creating task: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/tasks/<task_id>", methods=["PUT"])
@require_auth
def update_task(task_id):
    """
    Updates a task's status (marks it as completed/pending).
    Sends email to the creator when a task is completed.
    """
    data = request.json
    if not data or "status" not in data:
        return jsonify({"error": "Status is required"}), 400
        
    status = data.get("status")
    if status not in ["pending", "completed"]:
        return jsonify({"error": "Invalid status value"}), 400
        
    try:
        # Check if task exists and authorization
        task_res = supabase.table("tasks").select("*").eq("id", task_id).execute()
        if not task_res.data:
            return jsonify({"error": "Task not found"}), 404
            
        task = task_res.data[0]
        
        # Ensure only creator or assignee can update status
        if task["creator_id"] != g.user_id and task["assignee_id"] != g.user_id:
            return jsonify({"error": "Unauthorized to update this task"}), 403
            
        old_status = task["status"]
        
        # Update status in DB
        update_res = supabase.table("tasks").update({"status": status}).eq("id", task_id).execute()
        updated_task = update_res.data[0]
        
        # Resolve profiles for updated task
        creator_res = supabase.table("profiles").select("*").eq("id", task["creator_id"]).execute().data
        creator_profile = creator_res[0] if creator_res else None
        updated_task["creator"] = creator_profile
        
        assignee_profile = None
        if task["assignee_id"]:
            assignee_res = supabase.table("profiles").select("*").eq("id", task["assignee_id"]).execute().data
            assignee_profile = assignee_res[0] if assignee_res else None
            updated_task["assignee"] = assignee_profile
            
        # Send Email Notification to Creator on task completion
        if status == "completed" and old_status != "completed":
            # If the assignee completed it, notify creator (only if they are different people)
            if creator_profile and task["creator_id"] != g.user_id:
                assignee_name = assignee_profile.get("full_name") if assignee_profile else g.user_email
                send_task_completed_email(
                    creator_email=creator_profile.get("email"),
                    creator_name=creator_profile.get("full_name"),
                    assignee_name=assignee_name,
                    assignee_email=g.user_email,
                    task_title=task["title"]
                )
                
        return jsonify(updated_task), 200
        
    except Exception as e:
        print(f"Error updating task: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
