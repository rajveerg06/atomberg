"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { 
  Plus, 
  LogOut, 
  CheckCircle, 
  Clock, 
  User, 
  X, 
  Filter,
  Check
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "completed";
  creator_id: string;
  assignee_id: string | null;
  created_at: string;
  creator: UserProfile | null;
  assignee: UserProfile | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  
  // App state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filter, setFilter] = useState<"all" | "assigned_to_me" | "created_by_me" | "pending" | "completed">("all");
  
  // Task creation state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Initialize auth listener
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
      } else {
        setCurrentUser(session.user);
        setToken(session.access_token);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      } else {
        setCurrentUser(session.user);
        setToken(session.access_token);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Fetch users and tasks once token is loaded
  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        
        // Fetch tasks
        const tasksRes = await fetch("/api/tasks", { headers });
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData);
        }

        // Fetch users for assignment
        const usersRes = await fetch("/api/users", { headers });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !token) return;

    setSubmitting(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription,
          assignee_id: taskAssigneeId || null,
        }),
      });

      if (response.ok) {
        const newTask = await response.json();
        setTasks((prev) => [newTask, ...prev]);
        
        // Reset form
        setTaskTitle("");
        setTaskDescription("");
        setTaskAssigneeId("");
        setIsModalOpen(false);
      } else {
        const errData = await response.json();
        alert(`Error: ${errData.error || "Failed to create task"}`);
      }
    } catch (err) {
      console.error("Error creating task:", err);
      alert("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!token) return;

    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status: "completed" }),
      });

      if (response.ok) {
        const updatedTask = await response.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "completed", ...updatedTask } : t))
        );
      } else {
        const errData = await response.json();
        alert(`Error: ${errData.error || "Failed to complete task"}`);
      }
    } catch (err) {
      console.error("Error completing task:", err);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (!currentUser) return false;
    
    switch (filter) {
      case "assigned_to_me":
        return task.assignee_id === currentUser.id;
      case "created_by_me":
        return task.creator_id === currentUser.id;
      case "pending":
        return task.status === "pending";
      case "completed":
        return task.status === "completed";
      default:
        return true;
    }
  });

  if (loading && !currentUser) {
    return (
      <div className="page-loader">
        <div className="spinner"></div>
      </div>
    );
  }

  // Get current user details from profiles or fallback to google metadata
  const userMetadata = currentUser?.user_metadata || {};
  const currentUserName = userMetadata.full_name || userMetadata.name || currentUser?.email || "User";
  const currentUserAvatar = userMetadata.avatar_url || userMetadata.picture || "";

  return (
    <div className="app-container">
      {/* Header Panel */}
      <header className="glass-panel dashboard-header">
        <div className="user-profile">
          {currentUserAvatar ? (
            <img 
              src={currentUserAvatar} 
              alt={currentUserName} 
              className="avatar" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="avatar" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={20} />
            </div>
          )}
          <div className="user-info">
            <div className="name">{currentUserName}</div>
            <div className="email">{currentUser?.email}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            <Plus size={16} /> New Task
          </button>
          <button onClick={handleLogout} className="btn btn-secondary">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Main Dashboard Control Section */}
      <main>
        <div className="filter-bar">
          <div className="filters-group">
            <button 
              onClick={() => setFilter("all")} 
              className={`filter-btn ${filter === "all" ? "active" : ""}`}
            >
              All Tasks
            </button>
            <button 
              onClick={() => setFilter("assigned_to_me")} 
              className={`filter-btn ${filter === "assigned_to_me" ? "active" : ""}`}
            >
              Assigned to me
            </button>
            <button 
              onClick={() => setFilter("created_by_me")} 
              className={`filter-btn ${filter === "created_by_me" ? "active" : ""}`}
            >
              Created by me
            </button>
            <button 
              onClick={() => setFilter("pending")} 
              className={`filter-btn ${filter === "pending" ? "active" : ""}`}
            >
              Pending
            </button>
            <button 
              onClick={() => setFilter("completed")} 
              className={`filter-btn ${filter === "completed" ? "active" : ""}`}
            >
              Completed
            </button>
          </div>
          
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
            Showing {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Tasks grid */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
            <div className="spinner"></div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="glass-panel no-tasks">
            <div className="no-tasks-icon">📁</div>
            <h3>No Tasks Found</h3>
            <p style={{ fontSize: "14px", marginTop: "8px" }}>
              {filter === "all" 
                ? "Get started by creating your first task." 
                : "No tasks match the active filter criteria."}
            </p>
          </div>
        ) : (
          <div className="tasks-grid">
            {filteredTasks.map((task) => {
              const isPending = task.status === "pending";
              const canComplete = isPending && (
                task.assignee_id === currentUser?.id || 
                task.creator_id === currentUser?.id
              );

              return (
                <div key={task.id} className={`glass-card task-card ${task.status}`}>
                  <div className="task-card-header">
                    <h3 className="task-title-text" title={task.title}>{task.title}</h3>
                    <span className={`badge badge-${task.status}`}>
                      {task.status}
                    </span>
                  </div>
                  
                  <p className="task-description">
                    {task.description || "No description provided."}
                  </p>

                  <div className="task-meta-info">
                    {/* Profiles */}
                    <div style={{ display: "flex", gap: "16px" }}>
                      <div className="profile-tag">
                        <div>
                          <div className="profile-tag-label">Creator</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {task.creator?.avatar_url ? (
                              <img 
                                src={task.creator.avatar_url} 
                                alt={task.creator.full_name} 
                                className="profile-tag-avatar" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="profile-tag-avatar" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#374151" }}><User size={12} /></div>
                            )}
                            <span className="profile-tag-text" title={task.creator?.full_name || task.creator?.email || "Unknown"}>
                              {task.creator_id === currentUser?.id ? "Me" : (task.creator?.full_name || task.creator?.email || "Unknown")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="profile-tag">
                        <div>
                          <div className="profile-tag-label">Assignee</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {task.assignee ? (
                              <>
                                {task.assignee.avatar_url ? (
                                  <img 
                                    src={task.assignee.avatar_url} 
                                    alt={task.assignee.full_name} 
                                    className="profile-tag-avatar" 
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="profile-tag-avatar" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#374151" }}><User size={12} /></div>
                                )}
                                <span className="profile-tag-text" title={task.assignee.full_name || task.assignee.email}>
                                  {task.assignee_id === currentUser?.id ? "Me" : (task.assignee.full_name || task.assignee.email)}
                                </span>
                              </>
                            ) : (
                              <span className="profile-tag-text" style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                                Unassigned
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Completion Action */}
                    {canComplete && (
                      <button 
                        onClick={() => handleCompleteTask(task.id)}
                        className="btn btn-success"
                        style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px" }}
                        title="Mark Task as Completed"
                      >
                        <Check size={14} /> Done
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Task Modal Overlay */}
      <div className={`modal-overlay ${isModalOpen ? "active" : ""}`}>
        <div className="glass-panel modal-content">
          <div className="modal-header">
            <h2 className="modal-title">Create New Task</h2>
            <button onClick={() => setIsModalOpen(false)} className="modal-close">
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleCreateTask}>
            <div className="form-group">
              <label className="form-label" htmlFor="task-title">Task Title</label>
              <input 
                id="task-title"
                type="text" 
                className="form-input" 
                placeholder="Enter a descriptive title..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="task-desc">Description</label>
              <textarea 
                id="task-desc"
                className="form-textarea" 
                placeholder="Detail the work to be done..."
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                maxLength={500}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="task-assignee">Assignee</label>
              <select 
                id="task-assignee"
                className="form-select"
                value={taskAssigneeId}
                onChange={(e) => setTaskAssigneeId(e.target.value)}
              >
                <option value="">-- Leave Unassigned / Select Later --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name ? `${u.full_name} (${u.email})` : u.email} {u.id === currentUser?.id ? "(Me)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Creating..." : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
