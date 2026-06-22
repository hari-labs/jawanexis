import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { getUserTasks, updateTask, uploadTaskEvidence } from "@/services/api"
import { Check, Clock, Folder, Play, CheckCircle2, AlertTriangle, FileUp, X } from "lucide-react"

function priorityVariant(priority: string) {
  if (priority === "High") return "danger"
  if (priority === "Medium") return "warning"
  return "neutral"
}

export function TaskSelection() {
  const [me, setMe] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [activeTask, setActiveTask] = useState<string>("")
  const [loading, setLoading] = useState(true)

  // Evidence upload modal states
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [notes, setNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)

  const loadTasks = (userId: string) => {
    getUserTasks(userId).then((tasksList) => {
      setTasks(tasksList)
      if (tasksList.length > 0 && !activeTask) {
        setActiveTask(tasksList[0]._id)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    const storedUserStr = localStorage.getItem("user")
    if (storedUserStr) {
      try {
        const parsedUser = JSON.parse(storedUserStr)
        setMe(parsedUser)
        loadTasks(parsedUser.id)
      } catch (e) {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  function handleStatusChange(taskId: string, newStatus: string) {
    if (newStatus === "Completed") {
      // Intercept and open complete modal
      setCompletingTaskId(taskId)
      setNotes("")
      setFile(null)
      setShowCompleteModal(true)
      return
    }

    updateTask(taskId, { status: newStatus }).then(() => {
      if (me) {
        loadTasks(me.id)
      }
    })
  }

  const handleMarkCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completingTaskId) return

    setUploading(true)
    try {
      if (!file) {
        alert("Please select a screenshot or deliverable file as task evidence.")
        setUploading(false)
        return
      }

      const res = await uploadTaskEvidence(completingTaskId, file, notes)
      if (res.success) {
        alert("Evidence uploaded successfully! Task is now Under review.")
        setShowCompleteModal(false)
        setNotes("")
        setFile(null)
        if (me) loadTasks(me.id)
      } else {
        alert(res.message || "Failed to upload task evidence.")
      }
    } catch (err) {
      alert("Error submitting task completion.")
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-lg font-semibold">Loading tasks...</p>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-lg font-semibold">No tasks assigned yet</p>
        <p className="text-sm text-muted-foreground">Ask your team lead or admin to assign you a task.</p>
      </div>
    )
  }

  const selectedTask = tasks.find((t) => t._id === activeTask)

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Tasks Dashboard"
        description="Select what you are working on, track progress, and submit evidence deliverables."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {tasks.map((task) => {
          const selected = task._id === activeTask
          const isUnderReview = task.status === "Under review"
          const isCompleted = task.status === "Completed"
          const isLocked = isUnderReview || isCompleted

          return (
            <Card
              key={task._id}
              className={`cursor-pointer transition-all hover:border-primary/50 ${
                selected ? "border-primary ring-1 ring-primary/40" : ""
              }`}
              onClick={() => setActiveTask(task._id)}
            >
              <CardContent className="flex flex-col gap-4 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Badge variant={priorityVariant(task.priority) as never}>{task.priority}</Badge>
                    {isLocked ? (
                      <Badge variant={isCompleted ? "success" : "primary"}>
                        {task.status}
                      </Badge>
                    ) : (
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task._id, e.target.value)}
                        className="h-7 rounded-md border border-border bg-card px-1.5 text-xs font-medium outline-none focus:border-ring"
                      >
                        <option value="Not started">Not started</option>
                        <option value="In progress">In progress</option>
                        <option value="Completed">Mark Completed...</option>
                      </select>
                    )}
                  </div>
                  {selected && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground text-pretty">{task.title}</h3>
                  {task.feedback && (
                    <div className="mt-2 p-2 rounded bg-destructive/10 text-xs text-destructive flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span><strong>Lead Feedback:</strong> {task.feedback}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Folder className="h-4 w-4" /> {task.project_name || task.project}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> {task.estimate}
                  </span>
                </div>

                {!isLocked && (
                  <Button
                    size="sm"
                    className="w-full mt-2 inline-flex items-center justify-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStatusChange(task._id, "Completed")
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Mark Complete
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Selected:{" "}
          <span className="font-medium text-foreground">
            {selectedTask?.title || "None"}
          </span>
        </p>
        <Button disabled={selectedTask?.status === "Completed" || selectedTask?.status === "Under review"}>
          <Play className="h-4 w-4" /> Start tracking
        </Button>
      </div>

      {/* Completion Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Submit Task Deliverables
              </h3>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleMarkCompleteSubmit} className="p-5 flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">Completion Notes</label>
                <textarea
                  placeholder="Explain what was accomplished and list important files/results..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-24 w-full rounded-lg border border-border bg-secondary/30 p-3 text-sm outline-none focus:border-ring focus:bg-card"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">Evidence Attachment</label>
                <div className="relative border border-dashed border-border rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors p-4 flex flex-col items-center justify-center text-center cursor-pointer">
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    required
                  />
                  <FileUp className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-semibold">{file ? file.name : "Select Screenshot / File Deliverable"}</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF or ZIP files up to 10MB</p>
                </div>
              </div>

              <div className="flex gap-3 justify-end border-t border-border pt-4 mt-2">
                <Button type="button" variant="outline" onClick={() => setShowCompleteModal(false)}>Cancel</Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? "Uploading Deliverables..." : "Submit Deliverables"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
