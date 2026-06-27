import { useEffect, useState } from "react"
import { getUsers, createTask, getAssignedProjects, reviewTaskEvidence, getAllTasks } from "@/services/api"
import { BASE_URL } from "@/services/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { CheckCircle, XCircle, FileText, Calendar } from "lucide-react"

export function TeamLeadTasks() {
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")
  
  const [interns, setInterns] = useState<any[]>([])
  const [assigneeId, setAssigneeId] = useState("")
  
  const [title, setTitle] = useState("")
  const [estimate, setEstimate] = useState("")
  const [priority, setPriority] = useState("Medium")
  const [dueDate, setDueDate] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({})
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null)

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const teamLeadId = currentUser.id

  const loadData = () => {
    getAssignedProjects(teamLeadId)
      .then((projs) => {
        setProjects(projs)
        if (projs.length > 0) {
          setSelectedProjectId(projs[0].id)
        }
      })
      .catch(() => {})

    getUsers()
      .then((data) => setUsers(data))
      .catch(() => {})

    getAllTasks()
      .then((data) => setTasks(data))
      .catch(() => {})
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!selectedProjectId) {
      setInterns([])
      setAssigneeId("")
      return
    }
    const currentProj = projects.find(p => p.id === selectedProjectId)
    if (currentProj && currentProj.members) {
      setInterns(currentProj.members)
      if (currentProj.members.length > 0) {
        setAssigneeId(currentProj.members[0].id)
      } else {
        setAssigneeId("")
      }
    } else {
      setInterns([])
      setAssigneeId("")
    }
  }, [selectedProjectId, projects])

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !selectedProjectId || !assigneeId) {
      alert("Please fill all required fields and ensure project has interns assigned.")
      return
    }

    setSubmitting(true)
    const selectedProj = projects.find(p => p.id === selectedProjectId)
    const selectedIntern = interns.find(i => i.id === assigneeId)

    const payload = {
      user_id: assigneeId,
      project_id: selectedProjectId,
      project: selectedProj ? selectedProj.name : "General",
      title,
      estimate: estimate || "1h",
      priority,
      due_date: dueDate,
      status: "Not started"
    }

    try {
      await createTask(payload)
      alert(`Task assigned to ${selectedIntern ? selectedIntern.name : "Intern"} successfully!`)
      setTitle("")
      setEstimate("")
      setDueDate("")
      loadData()
    } catch (err) {
      alert("Error assigning task.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReview = async (taskId: string, status: "approved" | "rejected") => {
    const feedback = feedbacks[taskId] || ""
    if (status === "rejected" && !feedback.trim()) {
      alert("Please enter feedback notes for rejection.")
      return
    }

    setReviewingTaskId(taskId)
    try {
      const res = await reviewTaskEvidence(taskId, status, feedback, teamLeadId)
      if (res.success) {
        alert(`Task evidence reviewed successfully: ${status === 'approved' ? 'Approved' : 'Rejected'}.`)
        setFeedbacks(prev => ({ ...prev, [taskId]: "" }))
        loadData()
      } else {
        alert(res.message || "Failed to submit review.")
      }
    } catch (err) {
      alert("Error submitting task review.")
    } finally {
      setReviewingTaskId(null)
    }
  }

  const projectIds = projects.map(p => p.id)
  const ledTasks = tasks.filter(t => projectIds.includes(t.project_id))
  const underReviewTasks = ledTasks.filter(t => t.status === "Under review")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tasks Panel" description="Delegate projects tasks and review task evidence submissions." />

      {/* Review Task Evidence Section */}
      {underReviewTasks.length > 0 && (
        <Card className="border-primary/50 ring-1 ring-primary/20">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <CheckCircle className="h-5 w-5" /> Pending Task Evidence Reviews ({underReviewTasks.length})
            </CardTitle>
            <CardDescription>Review notes and deliverables submitted by interns before completing tasks</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {underReviewTasks.map((t) => (
              <div key={t._id} className="p-4 rounded-xl border border-border bg-secondary/10 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">{t.project_name || t.project}</span>
                    <Badge variant={t.priority === "High" ? "danger" : "warning"}>{t.priority}</Badge>
                  </div>
                  <h4 className="text-base font-semibold text-foreground">{t.title}</h4>
                  <p className="text-xs text-muted-foreground">Assignee: <span className="font-semibold">{t.user_name || "Assigned Intern"}</span></p>

                  {t.evidence && (
                    <div className="mt-3 p-3 rounded-lg border border-border bg-card space-y-2 text-xs">
                      <p className="font-semibold text-muted-foreground">Intern Completion Notes:</p>
                      <p className="italic text-foreground">{t.evidence.notes || "No notes provided"}</p>
                      {t.evidence.file_path ? (
                        <a
                          href={`${BASE_URL}/${t.evidence.file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary font-semibold hover:underline mt-1"
                        >
                          <FileText className="h-4 w-4" /> View Deliverable / Screenshot
                        </a>
                      ) : (
                        <p className="text-muted-foreground italic mt-1">No file attached</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="w-full md:w-64 flex flex-col gap-2">
                  <textarea
                    placeholder="Feedback / Rejection reason..."
                    value={feedbacks[t._id] || ""}
                    onChange={(e) => setFeedbacks(prev => ({ ...prev, [t._id]: e.target.value }))}
                    className="h-20 w-full rounded-lg border border-border bg-card p-2 text-xs outline-none focus:border-ring"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-destructive hover:bg-destructive/10 inline-flex items-center justify-center gap-1"
                      onClick={() => handleReview(t._id, "rejected")}
                      disabled={reviewingTaskId === t._id}
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 inline-flex items-center justify-center gap-1"
                      onClick={() => handleReview(t._id, "approved")}
                      disabled={reviewingTaskId === t._id}
                    >
                      <CheckCircle className="h-4 w-4" /> Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Task Creator Form */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Assign Task</CardTitle>
            <CardDescription>Assign a new task scoped to a project</CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length > 0 ? (
              <form onSubmit={handleAssignTask} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Project</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:border-ring"
                    required
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Project Intern</label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:border-ring"
                    required
                  >
                    {interns.length > 0 ? (
                      interns.map((i) => (
                        <option key={i.id} value={i.id}>{i.name} ({i.email})</option>
                      ))
                    ) : (
                      <option value="">No interns assigned to project</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Task Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Implement login verification"
                    className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring focus:bg-card"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Time Estimate</label>
                    <input
                      type="text"
                      value={estimate}
                      onChange={(e) => setEstimate(e.target.value)}
                      placeholder="e.g. 4h"
                      className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring focus:bg-card"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring focus:bg-card"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:border-ring"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <Button type="submit" className="mt-2" disabled={submitting || interns.length === 0}>
                  {submitting ? "Assigning..." : "Assign Task"}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                You are not currently assigned as a lead to any active projects.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tasks List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Team Tasks Board</CardTitle>
            <CardDescription>Monitor progress and reviews of tasks within your projects</CardDescription>
          </CardHeader>
          <CardContent>
            {ledTasks.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {ledTasks.map((t) => (
                  <li key={t._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-semibold">{t.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Assigned to: <span className="font-semibold text-foreground">{t.user_name || "Unknown"}</span> · Project: <span className="font-medium">{t.project_name || t.project}</span> · Estimate: {t.estimate}
                      </p>
                      {t.due_date && (
                        <p className="text-[10px] text-amber-500 font-medium mt-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Due by {t.due_date}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={t.priority === "High" ? "danger" : t.priority === "Medium" ? "warning" : "neutral"}>
                        {t.priority}
                      </Badge>
                      <Badge variant={t.status === "Completed" ? "success" : t.status === "Under review" ? "primary" : t.status === "In progress" ? "warning" : "neutral"}>
                        {t.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center py-10 text-sm text-muted-foreground">No tasks assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}