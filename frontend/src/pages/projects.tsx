import { BASE_URL } from "@/services/api";
import { useEffect, useState, useRef } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import {
  Folder,
  FolderPlus,
  User,
  Archive,
  Edit2,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Check,
  X,
  Download,
  Plus,
  BarChart3,
  Users as UsersIcon,
  ListTodo,
  ClipboardCheck,
  Eye
} from "lucide-react"
import {
  getUsersList,
  getProjects,
  createProject,
  archiveProject,
  updateProject,
  deleteProject,
  getProjectTasks,
  createTask,
  updateTask,
  deleteTask,
  getProjectEvidence,
  uploadTaskEvidence,
  reviewTaskEvidence
} from "@/services/api"

type Tab = "overview" | "members" | "tasks" | "evidence" | "progress"

export function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Project selection & workspace
  const [selectedProject, setSelectedProject] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [projectTasks, setProjectTasks] = useState<any[]>([])
  const [projectEvidence, setProjectEvidence] = useState<any[]>([])
  const [workspaceLoading, setWorkspaceLoading] = useState(false)

  // Modals / forms state
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState("")
  const [status, setStatus] = useState("in_progress")
  const [leadId, setLeadId] = useState("")
  const [memberIds, setMemberIds] = useState<string[]>([])

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editStartDate, setEditStartDate] = useState("")
  const [editEndDate, setEditEndDate] = useState("")
  const [editStatus, setEditStatus] = useState("")
  const [editLeadId, setEditLeadId] = useState("")
  const [editMemberIds, setEditMemberIds] = useState<string[]>([])

  // Task CRUD modal
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskModalMode, setTaskModalMode] = useState<"create" | "edit">("create")
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDesc, setTaskDesc] = useState("")
  const [taskAssignee, setTaskAssignee] = useState("")
  const [taskPriority, setTaskPriority] = useState<"Low" | "Medium" | "High">("Medium")
  const [taskDueDate, setTaskDueDate] = useState("")
  const [taskStatus, setTaskStatus] = useState("Pending")

  // Evidence submission modal
  const [showEvidenceModal, setShowEvidenceModal] = useState(false)
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null)
  const [evidenceNotes, setEvidenceNotes] = useState("")
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Review modal
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewTaskId, setReviewTaskId] = useState<string | null>(null)
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected" | "">("")
  const [reviewComments, setReviewComments] = useState("")

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const isAdmin = currentUser.role === "admin"
  const isTeamLead = currentUser.role === "team_lead"
  const isIntern = currentUser.role === "intern"

  const loadData = () => {
    setLoading(true)
    Promise.all([
      getProjects(),
      getUsersList()
    ]).then(([projectsData, usersData]) => {
      setProjects(projectsData)
      setUsers(usersData)
      
      // If a project is selected, update its reference in case data has changed
      if (selectedProject) {
        const updatedProj = projectsData.find((p: any) => p.id === selectedProject.id)
        if (updatedProj) {
          setSelectedProject(updatedProj)
          loadWorkspaceData(updatedProj.id)
        }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  const loadWorkspaceData = async (projectId: string) => {
    setWorkspaceLoading(true)
    try {
      const [tasks, evidence] = await Promise.all([
        getProjectTasks(projectId),
        getProjectEvidence(projectId)
      ])
      setProjectTasks(tasks)
      setProjectEvidence(evidence)
    } catch (e) {
      console.error("Error loading project workspace data", e)
    } finally {
      setWorkspaceLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      loadWorkspaceData(selectedProject.id)
    }
  }, [selectedProject?.id])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const payload = {
      name,
      description: desc,
      status,
      start_date: startDate,
      end_date: endDate,
      lead_id: leadId || null,
      member_ids: memberIds,
      created_by: currentUser.name || "admin"
    }
    try {
      const res = await createProject(payload)
      if (res.success) {
        alert("Project created successfully!")
        setName("")
        setDesc("")
        setStartDate(new Date().toISOString().slice(0, 10))
        setEndDate("")
        setStatus("in_progress")
        setLeadId("")
        setMemberIds([])
        setShowAddForm(false)
        loadData()
      } else {
        alert(res.message || "Failed to create project.")
      }
    } catch (err) {
      alert("Error creating project.")
    }
  }

  const handleUpdateProject = async (e: React.FormEvent, projectId: string) => {
    e.preventDefault()
    try {
      const res = await updateProject(projectId, {
        name: editName,
        description: editDesc,
        start_date: editStartDate,
        end_date: editEndDate,
        status: editStatus,
        lead_id: editLeadId || null,
        member_ids: editMemberIds
      })
      if (res.success) {
        alert("Project updated successfully!")
        setEditingProjectId(null)
        loadData()
      } else {
        alert(res.message || "Failed to update project.")
      }
    } catch (err) {
      alert("Error updating project.")
    }
  }

  const handleArchiveProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to archive this project?")) return
    try {
      const res = await archiveProject(projectId)
      if (res.success) {
        alert("Project archived successfully!")
        loadData()
      }
    } catch (err) {
      alert("Error archiving project.")
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("WARNING: Are you sure you want to permanently delete this project? This action is irreversible.")) return
    try {
      const res = await deleteProject(projectId)
      if (res.success) {
        alert("Project deleted successfully!")
        loadData()
      } else {
        alert(res.message || "Failed to delete project.")
      }
    } catch (err) {
      alert("Error deleting project.")
    }
  }

  const handleWorkspaceChangeLead = async (newLeadId: string) => {
    if (!selectedProject) return
    try {
      const res = await updateProject(selectedProject.id, {
        lead_id: newLeadId || null
      })
      if (res.success) {
        alert("Team Lead updated successfully!")
        loadData()
      } else {
        alert(res.message || "Failed to update Team Lead.")
      }
    } catch (e) {
      alert("Error updating Team Lead.")
    }
  }

  const handleWorkspaceAddMember = async (newMemberId: string) => {
    if (!selectedProject || !newMemberId) return
    const currentMemberIds = selectedProject.member_ids || []
    if (currentMemberIds.includes(newMemberId)) return
    const updatedMemberIds = [...currentMemberIds, newMemberId]
    try {
      const res = await updateProject(selectedProject.id, {
        member_ids: updatedMemberIds
      })
      if (res.success) {
        alert("Project member added successfully!")
        loadData()
      } else {
        alert(res.message || "Failed to add member.")
      }
    } catch (e) {
      alert("Error adding member.")
    }
  }

  const handleWorkspaceRemoveMember = async (memberIdToRemove: string) => {
    if (!selectedProject || !confirm("Are you sure you want to remove this member from the project?")) return
    const currentMemberIds = selectedProject.member_ids || []
    const updatedMemberIds = currentMemberIds.filter((mid: string) => mid !== memberIdToRemove)
    try {
      const res = await updateProject(selectedProject.id, {
        member_ids: updatedMemberIds
      })
      if (res.success) {
        alert("Project member removed successfully!")
        loadData()
      } else {
        alert(res.message || "Failed to remove member.")
      }
    } catch (e) {
      alert("Error removing member.")
    }
  }

  const startEditing = (p: any) => {
    setEditingProjectId(p.id)
    setEditName(p.name)
    setEditDesc(p.description || "")
    setEditStartDate(p.start_date || "")
    setEditEndDate(p.end_date || "")
    setEditStatus(p.status || "in_progress")
    setEditLeadId(p.lead_id || "")
    setEditMemberIds(p.member_ids || [])
  }

  const toggleMemberSelection = (id: string, isEdit: boolean) => {
    if (isEdit) {
      setEditMemberIds(prev =>
        prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
      )
    } else {
      setMemberIds(prev =>
        prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
      )
    }
  }

  // Task Operations
  const openCreateTaskModal = () => {
    setTaskModalMode("create")
    setEditingTaskId(null)
    setTaskTitle("")
    setTaskDesc("")
    setTaskAssignee("")
    setTaskPriority("Medium")
    setTaskDueDate("")
    setTaskStatus("Pending")
    setShowTaskModal(true)
  }

  const openEditTaskModal = (task: any) => {
    setTaskModalMode("edit")
    setEditingTaskId(task._id)
    setTaskTitle(task.title)
    setTaskDesc(task.description || "")
    setTaskAssignee(task.assigned_to || "")
    setTaskPriority(task.priority || "Medium")
    setTaskDueDate(task.due_date || "")
    setTaskStatus(task.status || "Pending")
    setShowTaskModal(true)
  }

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim() || !selectedProject) return

    const taskPayload = {
      project_id: selectedProject.id,
      title: taskTitle,
      description: taskDesc,
      assigned_to: taskAssignee || null,
      assigned_by: currentUser.id,
      priority: taskPriority,
      due_date: taskDueDate,
      status: taskStatus
    }

    try {
      if (taskModalMode === "create") {
        const res = await createTask(taskPayload)
        if (res.success) {
          setShowTaskModal(false)
          loadWorkspaceData(selectedProject.id)
        } else {
          alert(res.message || "Failed to create task")
        }
      } else if (editingTaskId) {
        const res = await updateTask(editingTaskId, taskPayload)
        if (res.success) {
          setShowTaskModal(false)
          loadWorkspaceData(selectedProject.id)
        } else {
          alert(res.message || "Failed to update task")
        }
      }
    } catch (error) {
      alert("Error saving task")
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return
    try {
      const res = await deleteTask(taskId)
      if (res.success && selectedProject) {
        loadWorkspaceData(selectedProject.id)
      } else {
        alert(res.message || "Failed to delete task")
      }
    } catch (e) {
      alert("Error deleting task")
    }
  }

  // Intern Task Status Update (non-evidence statuses)
  const handleQuickStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const res = await updateTask(taskId, { status: newStatus })
      if (res.success && selectedProject) {
        loadWorkspaceData(selectedProject.id)
      } else {
        alert(res.message || "Failed to update task status")
      }
    } catch (e) {
      alert("Error updating task status")
    }
  }

  // Evidence upload
  const openSubmitEvidenceModal = (taskId: string) => {
    setEvidenceTaskId(taskId)
    setEvidenceNotes("")
    setEvidenceFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    setShowEvidenceModal(true)
  }

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!evidenceTaskId || !selectedProject) return
    if (!evidenceFile) {
      alert("Please select a file to upload.")
      return
    }

    try {
      const res = await uploadTaskEvidence(
        evidenceTaskId,
        evidenceFile,
        evidenceNotes,
        currentUser.id
      )
      if (res.success) {
        alert("Deliverable submitted successfully!")
        setShowEvidenceModal(false)
        loadWorkspaceData(selectedProject.id)
      } else {
        alert(res.message || "Failed to submit deliverable")
      }
    } catch (e) {
      alert("Error uploading evidence")
    }
  }

  // Evidence Review
  const openReviewModal = (taskId: string, currentComments = "") => {
    setReviewTaskId(taskId)
    setReviewStatus("")
    setReviewComments(currentComments)
    setShowReviewModal(true)
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewTaskId || !reviewStatus || !selectedProject) {
      alert("Please select a review status (Approve or Reject).")
      return
    }

    try {
      const res = await reviewTaskEvidence(
        reviewTaskId,
        reviewStatus,
        reviewComments,
        currentUser.id
      )
      if (res.success) {
        alert("Evidence reviewed successfully.")
        setShowReviewModal(false)
        loadWorkspaceData(selectedProject.id)
      } else {
        alert(res.message || "Failed to submit review")
      }
    } catch (e) {
      alert("Error submitting review")
    }
  }

  const teamLeads = users.filter(u => u.role.toLowerCase() === "team_lead" || u.role.toLowerCase() === "team lead")
  const interns = users.filter(u => u.role.toLowerCase() === "intern")

  // Filter projects by current user visibility
  const visibleProjects = projects.filter(p => {
    if (isAdmin) return p.status !== "archived"
    if (isTeamLead) return p.lead_id === currentUser.id && p.status !== "archived"
    if (isIntern) return p.member_ids && p.member_ids.includes(currentUser.id) && p.status !== "archived"
    return false
  })

  // Filter tasks based on role in project
  const visibleTasks = projectTasks.filter(t => {
    if (isIntern) {
      return t.assigned_to === currentUser.id
    }
    return true
  })

  // Auto-calculated progress statistics
  const totalTasks = projectTasks.length
  const approvedTasksCount = projectTasks.filter(t => t.status === "Approved").length
  const completedTasksCount = projectTasks.filter(t => t.status === "Completed").length
  const pendingTasksCount = projectTasks.filter(t => t.status === "Pending").length
  const rejectedTasksCount = projectTasks.filter(t => t.status === "Rejected").length
  const underReviewTasksCount = projectTasks.filter(t => t.status === "Under Review").length
  const inProgressTasksCount = projectTasks.filter(t => t.status === "In Progress").length
  
  const progressPercentage = totalTasks > 0 ? Math.round((approvedTasksCount / totalTasks) * 100) : 0

  if (loading && projects.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading projects board...</p>
      </div>
    )
  }

  // Render workspace detail view
  if (selectedProject) {
    return (
      <div className="flex flex-col gap-6">
        {/* Workspace Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedProject(null)}
              className="h-9 w-9 rounded-lg"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">{selectedProject.name}</h1>
                <Badge variant={selectedProject.status === "completed" ? "success" : "warning"}>
                  {selectedProject.status === "completed" ? "Completed" : "In Progress"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{selectedProject.description || "No description provided."}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="text-right hidden md:block">
              <p className="text-xs text-muted-foreground uppercase font-medium">Timeline</p>
              <p className="text-sm font-semibold">
                {selectedProject.start_date || "-"} to {selectedProject.end_date || "Continuous"}
              </p>
            </div>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-border bg-muted/30 p-1 rounded-lg max-w-xl">
          {(["overview", "members", "tasks", "evidence", "progress"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded-md transition-all capitalize ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {workspaceLoading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <p className="text-muted-foreground text-sm">Loading workspace data...</p>
          </div>
        ) : (
          <div className="min-h-[300px]">
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-bold text-foreground">{selectedProject.name}</CardTitle>
                        <CardDescription className="mt-1">Detailed project metadata and ownership status.</CardDescription>
                      </div>
                      <Badge
                        variant={
                          selectedProject.status === "completed"
                            ? "success"
                            : selectedProject.status === "archived"
                            ? "neutral"
                            : "primary"
                        }
                        className="text-xs uppercase font-extrabold"
                      >
                        {selectedProject.status === "in_progress"
                          ? "In Progress"
                          : selectedProject.status === "completed"
                          ? "Completed"
                          : selectedProject.status === "archived"
                          ? "Archived"
                          : selectedProject.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-wider">Description</h3>
                      <p className="text-sm text-foreground bg-secondary/15 p-3.5 rounded-lg border border-border leading-relaxed">
                        {selectedProject.description || "No project description provided. Edit from the main Projects list."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <h4 className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Start Date</h4>
                        <p className="text-sm font-semibold mt-0.5 text-foreground">{selectedProject.start_date || "-"}</p>
                      </div>
                      <div>
                        <h4 className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Target End Date</h4>
                        <p className="text-sm font-semibold mt-0.5 text-foreground">{selectedProject.end_date || "Continuous"}</p>
                      </div>
                      <div>
                        <h4 className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Created By</h4>
                        <p className="text-sm font-semibold mt-0.5 text-foreground">{selectedProject.created_by || "Admin"}</p>
                      </div>
                      <div>
                        <h4 className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Created At</h4>
                        <p className="text-sm font-semibold mt-0.5 text-foreground">
                          {selectedProject.created_at ? new Date(selectedProject.created_at).toLocaleDateString() : "-"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-border/60">
                      <h4 className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1.5">Project Team Lead</h4>
                      {selectedProject.lead ? (
                        <div className="flex items-center gap-3 bg-secondary/10 p-3 rounded-lg border border-border/80">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                            {selectedProject.lead.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-foreground">{selectedProject.lead.name}</p>
                            <p className="text-[10px] text-muted-foreground">{selectedProject.lead.email}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No team lead assigned.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-col gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Workspace Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3.5">
                      <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                        <span className="text-muted-foreground font-medium">Intern Members</span>
                        <span className="font-bold text-foreground">{selectedProject.member_ids ? selectedProject.member_ids.length : 0}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                        <span className="text-muted-foreground font-medium">Total Tasks</span>
                        <span className="font-bold text-foreground">{totalTasks}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                        <span className="text-success font-medium">Approved Tasks</span>
                        <span className="font-bold text-success">{approvedTasksCount}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                        <span className="text-warning font-medium">Pending Tasks</span>
                        <span className="font-bold text-warning">{pendingTasksCount}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                        <span className="text-danger font-medium">Rejected Tasks</span>
                        <span className="font-bold text-danger">{rejectedTasksCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-muted-foreground font-semibold">Completion Progress</span>
                        <span className="font-black text-primary text-sm">{progressPercentage}%</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* MEMBERS TAB */}
            {/* MEMBERS TAB */}
            {activeTab === "members" && (
              <div className="flex flex-col gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Team Lead</CardTitle>
                    <CardDescription>Responsible for assignments, task creation, and deliverables reviews.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedProject.lead ? (() => {
                      const leadUser = users.find(u => u.id === selectedProject.lead_id)
                      const leadStatus = leadUser ? leadUser.status : "offline"
                      const displayStatus = leadStatus === "active" ? "Online" : (leadStatus === "paused" ? "Paused" : "Offline")
                      const statusBadgeColor = leadStatus === "active" ? "text-success font-bold" : (leadStatus === "paused" ? "text-warning font-bold" : "text-muted-foreground font-semibold")

                      return (
                        <div className="flex items-center justify-between bg-secondary/20 p-4 rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                              {selectedProject.lead.name.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-foreground">{selectedProject.lead.name}</p>
                              <p className="text-xs text-muted-foreground">{selectedProject.lead.email}</p>
                              <div className="flex flex-wrap gap-2 mt-1 text-[10px] font-bold text-muted-foreground uppercase">
                                <span>Role: Team Lead</span>
                                <span>•</span>
                                <span>
                                  Status: <span className={statusBadgeColor}>{displayStatus}</span>
                                </span>
                                <span>•</span>
                                <span className="text-primary">Project Join State: Assigned Lead</span>
                              </div>
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-2">
                              <select
                                onChange={(e) => handleWorkspaceChangeLead(e.target.value)}
                                value={selectedProject.lead_id || ""}
                                className="h-9 rounded-lg border border-border bg-card px-2 text-xs font-semibold focus:border-ring outline-none"
                              >
                                <option value="">Change Lead...</option>
                                {teamLeads.map(l => (
                                  <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )
                    })() : (
                      <div className="flex items-center justify-between bg-secondary/20 p-4 rounded-lg border border-border">
                        <p className="text-sm text-muted-foreground italic">No team lead assigned.</p>
                        {isAdmin && (
                          <select
                            onChange={(e) => handleWorkspaceChangeLead(e.target.value)}
                            value=""
                            className="h-9 rounded-lg border border-border bg-card px-2 text-xs font-semibold focus:border-ring outline-none"
                          >
                            <option value="">Assign Lead...</option>
                            {teamLeads.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
 
                <Card>
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>Intern Members ({selectedProject.members ? selectedProject.members.length : 0})</CardTitle>
                      <CardDescription>Roster of interns assigned to this project.</CardDescription>
                    </div>
                    {isAdmin && (
                      <div className="shrink-0">
                        <select
                          onChange={(e) => {
                            handleWorkspaceAddMember(e.target.value)
                            e.target.value = ""
                          }}
                          value=""
                          className="h-9 w-full sm:w-48 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold focus:border-ring outline-none"
                        >
                          <option value="">Add Intern Member...</option>
                          {interns
                            .filter(i => !(selectedProject.member_ids || []).includes(i.id))
                            .map(i => (
                              <option key={i.id} value={i.id}>{i.name}</option>
                            ))
                          }
                        </select>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedProject.members && selectedProject.members.length > 0 ? (
                        selectedProject.members.map((member: any) => {
                          const memberUser = users.find(u => u.id === member.id)
                          const memberStatus = memberUser ? memberUser.status : "offline"
                          const displayStatus = memberStatus === "active" ? "Online" : (memberStatus === "paused" ? "Paused" : "Offline")
                          const statusBadgeColor = memberStatus === "active" ? "text-success font-bold" : (memberStatus === "paused" ? "text-warning font-bold" : "text-muted-foreground font-semibold")

                          return (
                            <div key={member.id} className="flex items-center justify-between bg-secondary/10 p-3.5 rounded-lg border border-border/60 hover:bg-secondary/20 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground font-semibold text-sm">
                                  {member.name.slice(0, 2).toUpperCase()}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                                  <div className="flex gap-2 mt-0.5 text-[9px] font-bold text-muted-foreground uppercase">
                                    <span>Role: Intern</span>
                                    <span>•</span>
                                    <span>
                                      Status: <span className={statusBadgeColor}>{displayStatus}</span>
                                    </span>
                                    <span>•</span>
                                    <span className="text-success font-extrabold">Project Join State: Assigned Member</span>
                                  </div>
                                </div>
                              </div>
                              {isAdmin && (
                                <Button
                                  variant="outline"
                                  onClick={() => handleWorkspaceRemoveMember(member.id)}
                                  className="h-7 px-2 text-danger hover:bg-danger/10 border-danger/20 hover:border-danger text-xs font-bold shrink-0"
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-sm text-muted-foreground italic col-span-2">No interns assigned to this project.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TASKS TAB */}
            {activeTab === "tasks" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Project Tasks</h2>
                    <p className="text-xs text-muted-foreground">
                      {isIntern ? "Tasks assigned to you in this project" : "List of all tasks scoped to this project"}
                    </p>
                  </div>
                  {isTeamLead && selectedProject.lead_id === currentUser.id && (
                    <Button onClick={openCreateTaskModal} className="inline-flex items-center gap-1">
                      <Plus className="h-4 w-4" />
                      Create Task
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleTasks.map((task) => {
                    const assignee = selectedProject.members?.find((m: any) => m.id === task.assigned_to)
                    const assigneeName = assignee ? assignee.name : task.assigned_to_name || "Unassigned"

                    return (
                      <Card key={task._id} className="hover:shadow-sm transition-shadow relative">
                        <CardHeader className="pb-3 border-b border-border/50">
                          <div className="flex items-center justify-between gap-1.5">
                            <Badge
                              variant={
                                task.priority === "High"
                                  ? "danger"
                                  : task.priority === "Medium"
                                  ? "warning"
                                  : "neutral"
                              }
                              className="text-[10px] uppercase font-bold"
                            >
                              {task.priority || "Medium"}
                            </Badge>
                            <Badge
                              variant={
                                task.status === "Approved"
                                  ? "success"
                                  : task.status === "Rejected"
                                  ? "danger"
                                  : task.status === "Under Review"
                                  ? "warning"
                                  : "neutral"
                              }
                              className="text-[10px] font-bold"
                            >
                              {task.status || "Pending"}
                            </Badge>
                          </div>
                          <CardTitle className="text-base mt-2">{task.title}</CardTitle>
                          <CardDescription className="line-clamp-2 text-xs text-muted-foreground mt-1">
                            {task.description || "No description provided."}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-3 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground font-medium">Assigned To:</span>
                            <span className="font-semibold text-foreground">{assigneeName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground font-medium">Due Date:</span>
                            <span className="font-semibold text-foreground">{task.due_date || "No deadline"}</span>
                          </div>

                          {/* Render review feedback if any */}
                          {task.evidence && task.evidence.review_comments && (
                            <div className="bg-secondary/35 border border-border p-2 rounded text-[11px] mt-2">
                              <p className="font-bold text-muted-foreground uppercase text-[9px] tracking-wide">Reviewer Feedback</p>
                              <p className="text-foreground italic mt-0.5">"{task.evidence.review_comments}"</p>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-1.5">
                            {/* Team Lead Actions */}
                            {isTeamLead && selectedProject.lead_id === currentUser.id && (
                              <>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => openEditTaskModal(task)}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteTask(task._id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                {task.status === "Under Review" && (
                                  <Button
                                    size="sm"
                                    onClick={() => openReviewModal(task._id, task.evidence?.review_comments || "")}
                                    className="text-xs font-bold h-8 ml-auto"
                                  >
                                    Review
                                  </Button>
                                )}
                              </>
                            )}

                            {/* Intern Actions */}
                            {isIntern && task.assigned_to === currentUser.id && (
                              <div className="flex flex-col w-full gap-2 pt-1">
                                {(task.status === "Pending" || task.status === "In Progress") ? (
                                  <>
                                    <div className="flex items-center gap-1.5 w-full">
                                      <span className="text-[10px] text-muted-foreground uppercase font-bold shrink-0">Status:</span>
                                      <select
                                        value={task.status}
                                        onChange={(e) => handleQuickStatusChange(task._id, e.target.value)}
                                        className="h-8 text-xs rounded border border-border bg-card px-2 flex-1 outline-none font-semibold"
                                      >
                                        <option value="Pending">Pending</option>
                                        <option value="In Progress">In Progress</option>
                                      </select>
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={() => openSubmitEvidenceModal(task._id)}
                                      className="w-full text-xs font-semibold h-8"
                                    >
                                      Upload Evidence
                                    </Button>
                                  </>
                                ) : task.status === "Rejected" ? (
                                  <>
                                    <div className="text-center py-1.5 font-bold text-danger text-[10px] uppercase bg-danger/10 border border-danger/20 rounded">
                                      Rejected by Lead
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={() => openSubmitEvidenceModal(task._id)}
                                      className="w-full text-xs font-semibold h-8"
                                    >
                                      Resubmit Deliverable
                                    </Button>
                                  </>
                                ) : task.status === "Under Review" ? (
                                  <div className="text-center py-1.5 font-bold text-warning text-[10px] uppercase bg-warning/10 border border-warning/20 rounded">
                                    Under Review (Awaiting Lead)
                                  </div>
                                ) : (
                                  <div className="text-center py-1.5 font-bold text-success text-[10px] uppercase bg-success/10 border border-success/20 rounded">
                                    Approved & Completed
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                  {visibleTasks.length === 0 && (
                    <p className="text-center py-10 text-sm text-muted-foreground col-span-3">No tasks found.</p>
                  )}
                </div>
              </div>
            )}

            {/* EVIDENCE TAB */}
            {activeTab === "evidence" && (
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Project Evidence Log</h2>
                  <p className="text-xs text-muted-foreground">Verify task completions and submitted artifacts.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projectEvidence.map((ev) => {
                    const statusColor =
                      ev.status === "approved"
                        ? "bg-success/10 text-success border-success/20"
                        : ev.status === "rejected"
                        ? "bg-danger/10 text-danger border-danger/20"
                        : "bg-warning/10 text-warning border-warning/20"

                    // If intern role, we only show evidence uploaded by them, otherwise all
                    if (isIntern && ev.uploaded_by !== currentUser.id) return null

                    return (
                      <Card key={ev._id} className="border hover:shadow-sm transition-shadow">
                        <CardHeader className="pb-3 border-b border-border/50">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-semibold">
                              By {ev.user_name || "Intern"}
                            </span>
                            <span className={`text-[10px] font-bold border px-2 py-0.5 rounded capitalize ${statusColor}`}>
                              {ev.status}
                            </span>
                          </div>
                          <CardTitle className="text-sm font-bold mt-2">
                            Task: {ev.task_title || "Unknown Task"}
                          </CardTitle>
                          <span className="text-[10px] text-muted-foreground mt-0.5 block">
                            Submitted: {ev.submitted_at ? new Date(ev.submitted_at).toLocaleString() : "-"}
                          </span>
                        </CardHeader>
                        <CardContent className="pt-3 text-xs space-y-3">
                          <div>
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Notes</span>
                            <p className="text-foreground mt-0.5 bg-secondary/10 p-2.5 rounded border border-border/60">
                              {ev.notes || "No notes submitted."}
                            </p>
                          </div>

                          {ev.file_path && (
                            <div className="flex items-center justify-between bg-primary/5 hover:bg-primary/10 border border-primary/20 p-2.5 rounded-lg transition-colors">
                              <span className="flex items-center gap-2 font-semibold text-primary truncate max-w-[80%]">
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="truncate text-xs">{ev.file_path.split("/").pop()}</span>
                              </span>
                              <a
                                href={`${BASE_URL}/${ev.file_path}`}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          )}

                          {ev.review_comments && (
                            <div className="bg-secondary/40 border border-border p-2.5 rounded-lg text-xs">
                              <span className="font-bold text-muted-foreground uppercase text-[10px] block">Review Notes</span>
                              <p className="text-foreground italic mt-0.5">"{ev.review_comments}"</p>
                              {ev.reviewed_by && (
                                <span className="text-[10px] text-muted-foreground block text-right mt-1">
                                  — Reviewed at {ev.reviewed_at ? new Date(ev.reviewed_at).toLocaleDateString() : "-"}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/40">
                            {/* Team Lead Actions */}
                            {isTeamLead && selectedProject.lead_id === currentUser.id && (
                              <Button
                                size="sm"
                                className="text-xs h-8"
                                onClick={() => openReviewModal(ev.task_id, ev.review_comments)}
                              >
                                Review Deliverable
                              </Button>
                            )}

                            {/* Intern Actions */}
                            {isIntern && ev.uploaded_by === currentUser.id && ev.status === "rejected" && (
                              <Button
                                size="sm"
                                className="text-xs h-8"
                                onClick={() => openSubmitEvidenceModal(ev.task_id)}
                              >
                                Resubmit Evidence
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                  {projectEvidence.filter(ev => !isIntern || ev.uploaded_by === currentUser.id).length === 0 && (
                    <p className="text-center py-10 text-sm text-muted-foreground col-span-2">No evidence submitted.</p>
                  )}
                </div>
              </div>
            )}

            {/* PROGRESS TAB */}
            {activeTab === "progress" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Completion Progress</CardTitle>
                    <CardDescription>Calculated from Approved Tasks vs. Total Tasks.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <div className="relative flex items-center justify-center h-32 w-32 rounded-full border-8 border-secondary/40">
                      <div className="text-center">
                        <span className="text-3xl font-extrabold text-foreground">{progressPercentage}%</span>
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">Approved</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-4 text-center">
                      <span className="font-semibold text-foreground">{approvedTasksCount}</span> of <span className="font-semibold text-foreground">{totalTasks}</span> tasks approved.
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Deliverables Breakdown</CardTitle>
                    <CardDescription>Summary of tasks in each status phase.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary/15 border border-border p-3.5 rounded-lg">
                      <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Completed Tasks</span>
                      <p className="text-2xl font-black text-foreground mt-1">{completedTasksCount}</p>
                    </div>
                    <div className="bg-secondary/15 border border-border p-3.5 rounded-lg">
                      <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Pending Tasks</span>
                      <p className="text-2xl font-black text-foreground mt-1">{pendingTasksCount}</p>
                    </div>
                    <div className="bg-secondary/15 border border-border p-3.5 rounded-lg">
                      <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Approved Tasks</span>
                      <p className="text-2xl font-black text-success mt-1">{approvedTasksCount}</p>
                    </div>
                    <div className="bg-secondary/15 border border-border p-3.5 rounded-lg">
                      <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Rejected Tasks</span>
                      <p className="text-2xl font-black text-danger mt-1">{rejectedTasksCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* =======================================================
            TASK CREATION / EDITING MODAL
           ======================================================= */}
        {showTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold text-foreground">
                  {taskModalMode === "create" ? "Create Scoped Task" : "Edit Task Details"}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setShowTaskModal(false)} className="h-8 w-8 rounded-lg">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleSaveTask} className="space-y-4 pt-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">Task Title</label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Complete Schema Integrations"
                    className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring focus:bg-card"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">Description</label>
                  <textarea
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    placeholder="Provide details and expectations..."
                    className="h-20 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-ring focus:bg-card"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">Assignee</label>
                    <select
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:border-ring"
                      required
                    >
                      <option value="">Select Assignee...</option>
                      {selectedProject.members?.filter((m: any) => m.role?.toLowerCase() === "intern").map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as any)}
                      className="h-10 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:border-ring"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">Due Date</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">Status</label>
                    <select
                      value={taskStatus}
                      onChange={(e) => setTaskStatus(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:border-ring"
                      disabled={taskModalMode === "create"}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-3">
                  <Button type="button" variant="outline" onClick={() => setShowTaskModal(false)}>Cancel</Button>
                  <Button type="submit">Save Task</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =======================================================
            EVIDENCE SUBMISSION MODAL
           ======================================================= */}
        {showEvidenceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold text-foreground">Submit Task Deliverables</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowEvidenceModal(false)} className="h-8 w-8 rounded-lg">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleSubmitEvidence} className="space-y-4 pt-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">Attachment File</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                    className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Upload screenshots, logs, design links, or compressed source folders.</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">Completion Notes</label>
                  <textarea
                    value={evidenceNotes}
                    onChange={(e) => setEvidenceNotes(e.target.value)}
                    placeholder="Provide details on features implemented, bugs fixed, or special setups..."
                    className="h-24 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-ring focus:bg-card"
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end pt-3">
                  <Button type="button" variant="outline" onClick={() => setShowEvidenceModal(false)}>Cancel</Button>
                  <Button type="submit">Submit Evidence</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =======================================================
            EVIDENCE REVIEW MODAL
           ======================================================= */}
        {showReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold text-foreground">Review Task Deliverable</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowReviewModal(false)} className="h-8 w-8 rounded-lg">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-4 pt-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">Review Verdict</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setReviewStatus("approved")}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 text-center text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        reviewStatus === "approved"
                          ? "border-success bg-success/10 text-success"
                          : "border-border hover:border-success/35 text-muted-foreground"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve Evidence
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewStatus("rejected")}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 text-center text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        reviewStatus === "rejected"
                          ? "border-danger bg-danger/10 text-danger"
                          : "border-border hover:border-danger/35 text-muted-foreground"
                      }`}
                    >
                      <AlertCircle className="h-4 w-4" />
                      Reject Evidence
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">Review Comments / Feedback</label>
                  <textarea
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    placeholder="Provide recommendations, outline defects, or specify approval milestones..."
                    className="h-24 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-ring focus:bg-card"
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end pt-3">
                  <Button type="button" variant="outline" onClick={() => setShowReviewModal(false)}>Cancel</Button>
                  <Button type="submit">Submit Review Verdict</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render project listing board view
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Projects Board" description="Track and scope workstreams, timelines, and assignments.">
        {isAdmin && (
          <Button onClick={() => setShowAddForm(!showAddForm)} className="inline-flex items-center gap-1.5">
            <FolderPlus className="h-4 w-4" />
            Create Project
          </Button>
        )}
      </PageHeader>

      {showAddForm && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
            <CardDescription>Configure project metadata and save team lead and intern members together</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProject} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Pulse Tracking API"
                  className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring focus:bg-card"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Description</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Milestones and scope definition..."
                  className="h-20 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-ring focus:bg-card"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring focus:bg-card"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Target End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring focus:bg-card"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Team Lead</label>
                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:border-ring"
                >
                  <option value="">Select Team Lead...</option>
                  {teamLeads.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Intern Members</label>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-secondary/20 p-2.5 space-y-1.5">
                  {interns.map(i => (
                    <label key={i.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={memberIds.includes(i.id)}
                        onChange={() => toggleMemberSelection(i.id, false)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span>{i.name} ({i.email})</span>
                    </label>
                  ))}
                  {interns.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No registered interns available.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
                <Button type="submit">Create Project & Assignments</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {visibleProjects.map((proj) => {
          const isEditing = editingProjectId === proj.id

          return (
            <Card key={proj.id} className="hover:shadow-md transition-shadow">
              {isEditing ? (
                <CardContent className="pt-6">
                  <form onSubmit={(e) => handleUpdateProject(e, proj.id)} className="flex flex-col gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">Project Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">Description</label>
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="h-20 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-ring"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">Start Date</label>
                        <input
                          type="date"
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                          className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">Target End Date</label>
                        <input
                          type="date"
                          value={editEndDate}
                          onChange={(e) => setEditEndDate(e.target.value)}
                          className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">Team Lead</label>
                      <select
                        value={editLeadId}
                        onChange={(e) => setEditLeadId(e.target.value)}
                        className="h-10 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:border-ring"
                      >
                        <option value="">Select Team Lead...</option>
                        {teamLeads.map(l => (
                          <option key={l.id} value={l.id}>{l.name} ({l.email})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">Intern Members</label>
                      <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-secondary/20 p-2.5 space-y-1.5">
                        {interns.map(i => (
                          <label key={i.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editMemberIds.includes(i.id)}
                              onChange={() => toggleMemberSelection(i.id, true)}
                              className="rounded border-border text-primary focus:ring-primary"
                            />
                            <span>{i.name} ({i.email})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="h-10 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:border-ring"
                      >
                        <option value="in_progress">In Progress</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditingProjectId(null)}>Cancel</Button>
                      <Button type="submit" size="sm">Save Changes</Button>
                    </div>
                  </form>
                </CardContent>
              ) : (
                <>
                  <CardHeader className="pb-3 border-b border-sidebar-border">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Folder className="h-5 w-5" />
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={proj.status === "completed" ? "success" : proj.status === "archived" ? "danger" : "warning"}>
                          {proj.status === "completed" ? "Completed" : proj.status === "archived" ? "Archived" : "In Progress"}
                        </Badge>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => startEditing(proj)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="outline" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleArchiveProject(proj.id)}>
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="outline" className="h-8 w-8 text-destructive hover:bg-destructive/10 animate-pulse hover:animate-none" onClick={() => handleDeleteProject(proj.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <CardTitle className="mt-3 text-base">{proj.name}</CardTitle>
                    <CardDescription className="mt-1 text-sm text-muted-foreground">{proj.description || "No description provided."}</CardDescription>
                  </CardHeader>

                  <CardContent className="pt-4 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block uppercase font-medium">Created Date</span>
                        <span className="font-semibold text-foreground mt-0.5 block">
                          {proj.created_at ? proj.created_at.slice(0, 10) : proj.start_date || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block uppercase font-medium">Target End Date</span>
                        <span className="font-semibold text-foreground mt-0.5 block">{proj.end_date || "Continuous"}</span>
                      </div>
                    </div>

                    <div className="border-t border-sidebar-border pt-3">
                      <span className="text-xs text-muted-foreground block uppercase font-medium mb-1.5">Team Lead</span>
                      {proj.lead ? (
                        <div className="flex items-center text-sm">
                          <span className="flex items-center gap-2 font-semibold text-foreground">
                            <User className="h-4 w-4 text-primary" /> {proj.lead.name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">({proj.lead.email})</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No lead assigned.</span>
                      )}
                    </div>

                    <div className="border-t border-sidebar-border pt-3">
                      <span className="text-xs text-muted-foreground block uppercase font-medium mb-1.5">Intern Members ({proj.members ? proj.members.length : 0})</span>
                      {proj.members && proj.members.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {proj.members.map((m: any) => (
                            <Badge key={m.id} variant="neutral" className="text-[11px] py-0.5 px-2">
                              {m.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No interns assigned.</p>
                      )}
                    </div>

                    {/* Completion Progress & Stats */}
                    <div className="border-t border-sidebar-border pt-3">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">Completion Progress</span>
                        <span className="text-foreground">{proj.progress || 0}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${proj.progress || 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center text-[9px] font-bold mt-1 border-t border-border/20 pt-2.5">
                      <div className="bg-secondary/15 p-1 rounded">
                        <span className="text-muted-foreground block uppercase font-medium">Pending</span>
                        <span className="text-foreground mt-0.5 block text-xs font-semibold">{proj.pending_tasks || 0}</span>
                      </div>
                      <div className="bg-secondary/15 p-1 rounded">
                        <span className="text-muted-foreground block uppercase font-medium">Completed</span>
                        <span className="text-foreground mt-0.5 block text-xs font-semibold">{proj.completed_tasks || 0}</span>
                      </div>
                      <div className="bg-secondary/15 p-1 rounded">
                        <span className="text-success block uppercase font-medium">Approved</span>
                        <span className="text-success mt-0.5 block text-xs font-semibold">{proj.approved_tasks || 0}</span>
                      </div>
                      <div className="bg-secondary/15 p-1 rounded">
                        <span className="text-danger block uppercase font-medium">Rejected</span>
                        <span className="text-danger mt-0.5 block text-xs font-semibold">{proj.rejected_tasks || 0}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-sidebar-border flex justify-end">
                      <Button
                        onClick={() => setSelectedProject(proj)}
                        className="inline-flex items-center gap-1.5 text-xs h-9 px-4 font-semibold"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Open Project Workspace
                      </Button>
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          )
        })}
        {visibleProjects.length === 0 && (
          <p className="text-center py-10 text-sm text-muted-foreground col-span-2">No projects assigned to you.</p>
        )}
      </div>
    </div>
  )
}