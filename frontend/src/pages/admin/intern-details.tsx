import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import {
  ArrowLeft,
  AppWindow,
  Globe,
  ListChecks,
  Clock,
  Coffee,
  Mail,
  MapPin,
  Calendar,
  Camera,
  Gauge,
  X,
  Activity,
} from "lucide-react"

function fmtDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) {
    return `${h}h ${m}m`
  }
  if (m > 0) {
    return `${m}m`
  }
  return `${s}s`
}
import { PageHeader } from "@/components/page-header"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { ProductivityRing } from "@/components/productivity-ring"
import { getInternSummary, getRecentActivity, getProductivityTrend, createTask, getUserTasks } from "@/services/api"
import { Badge } from "@/components/ui/badge"

export function InternDetails() {
  const [user, setUser] = useState<any | null>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [productivityTrend, setProductivityTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { id } = useParams()
  const navigate = useNavigate()

  const [selectedSessionId, setSelectedSessionId] = useState<string>("all")
  const [previewScreenshot, setPreviewScreenshot] = useState<any | null>(null)

  const [tasks, setTasks] = useState<any[]>([])
  const [taskTitle, setTaskTitle] = useState("")
  const [taskPriority, setTaskPriority] = useState("Medium")
  const [taskProject, setTaskProject] = useState("")
  const [taskEstimate, setTaskEstimate] = useState("")

  useEffect(() => {
      if (!id) return;
      
      setLoading(true)
      
      getInternSummary(id, selectedSessionId)
          .then(data => {
              setUser(data)
              setLoading(false)
          })
          .catch(() => {
              setUser(null)
              setLoading(false)
          })

      getRecentActivity(id)
          .then(data => setRecentActivity(data))

      getProductivityTrend(7, id)
          .then(data => setProductivityTrend(data))

      getUserTasks(id)
          .then(data => setTasks(data))

  }, [id, selectedSessionId])

  function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskTitle.trim() || !id) return
    createTask({
      user_id: id,
      title: taskTitle,
      priority: taskPriority,
      project: taskProject || "General",
      estimate: taskEstimate || "1h",
      status: "Not started"
    }).then(() => {
      setTaskTitle("")
      setTaskProject("")
      setTaskEstimate("")
      getUserTasks(id).then(data => setTasks(data))
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-lg font-semibold">Loading intern details...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-lg font-semibold">Intern not found</p>
        <Button onClick={() => navigate("/admin/interns")}>Back to interns</Button>
      </div>
    )
  }

  const activity = recentActivity.filter((e) => e.internId === user.id)
  const infoItems = [
    { icon: Mail, label: "Email", value: user.email },
    { icon: MapPin, label: "Timezone", value: user.timezone || "IST" },
    { icon: Calendar, label: "Joined", value: user.joinedDate || "-" },
  ]
  const metrics = [
    { icon: Clock, label: "Total work time", value: fmtDuration((user.total_work_mins || 0) * 60) },
    { icon: Clock, label: "Total productive time", value: fmtDuration((user.total_active_mins || 0) * 60) },
    { icon: Coffee, label: "Total idle time", value: fmtDuration((user.total_idle_mins || 0) * 60) },
    { icon: Gauge, label: "Productivity", value: `${user.productivity}%` },
    { icon: Camera, label: "Screenshots captured", value: String(user.screenshot_count || 0) },
    { icon: AppWindow, label: "Applications used", value: String(user.app_count || 0) },
    { icon: Globe, label: "Websites visited", value: String(user.site_count || 0) },
    { icon: AppWindow, label: "Current app", value: user.currentApp || "-" },
    { icon: Globe, label: "Current site", value: user.currentSite || "-" },
    { icon: ListChecks, label: "Assigned task", value: user.task || "-" },
  ]

  return (
    <div>
      <Link to="/admin/interns" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to interns
      </Link>

      {/* Session details view header */}
      {selectedSessionId !== "all" && (
        <Card className="mb-4 bg-primary/5 border border-primary/20">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2 text-sm text-primary font-medium">
              <Clock className="h-4 w-4" />
              <span>
                Viewing stats for session starting on{" "}
                <strong>
                  {(() => {
                    const activeSess = user.sessions?.find((s: any) => s.id === selectedSessionId)
                    return activeSess ? `${activeSess.start_time.slice(0, 10)} at ${activeSess.start_time.slice(11, 19)}` : "Selected Session"
                  })()}
                </strong>
              </span>
            </div>
            <Button size="sm" onClick={() => setSelectedSessionId("all")}>
              Show All Sessions
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Profile header */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} color={user.avatarColor} size={60} />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{user.name}</h1>
              <p className="text-sm text-muted-foreground">{user.role}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={user.status} />
                <span className="text-xs text-muted-foreground">Active {(user.lastActive || "-").toLowerCase()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <ProductivityRing value={user.productivity} size={56} />
              <p className="mt-1 text-xs text-muted-foreground">Productivity</p>
            </div>
            <Link to="/admin/screenshots">
              <Button variant="outline">
                <Camera className="h-4 w-4" />
                Screenshots
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile information</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {infoItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="truncate text-sm font-medium">{item.value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current session</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {metrics.map((m) => (
                <div key={m.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <m.icon className="h-4 w-4" />
                    {m.label}
                  </span>
                  <span className="truncate text-sm font-medium">{m.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assign New Task</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTask} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Title</label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Code database schema"
                    className="h-9 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring focus:bg-card"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Project</label>
                    <input
                      type="text"
                      value={taskProject}
                      onChange={(e) => setTaskProject(e.target.value)}
                      placeholder="e.g. Backend"
                      className="h-9 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring focus:bg-card"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Estimate</label>
                    <input
                      type="text"
                      value={taskEstimate}
                      onChange={(e) => setTaskEstimate(e.target.value)}
                      placeholder="e.g. 4h"
                      className="h-9 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring focus:bg-card"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-card px-2 text-sm outline-none focus:border-ring"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <Button type="submit" size="sm" className="mt-2">Assign Task</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Productivity this week</CardTitle>
              <CardDescription>Daily productivity score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={productivityTrend} margin={{ left: -20, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="detail" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 13 }} />
                    <Area type="monotone" dataKey="productivity" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#detail)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Application Usage</CardTitle>
                <CardDescription>Time spent per application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {user.apps && user.apps.length > 0 ? (
                  user.apps.map((app: any) => (
                    <div key={app.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[150px]">{app.name}</span>
                        <span className="text-muted-foreground text-xs">{fmtDuration(app.duration)} ({app.percentage}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${app.percentage}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No application usage recorded.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Website Usage</CardTitle>
                <CardDescription>Time spent per domain</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {user.sites && user.sites.length > 0 ? (
                  user.sites.map((site: any) => (
                    <div key={site.domain} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[150px]">{site.domain}</span>
                        <span className="text-muted-foreground text-xs">{fmtDuration(site.duration)} ({site.percentage}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-chart-4 rounded-full" style={{ width: `${site.percentage}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No website usage recorded.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Screenshots Gallery */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Screenshots</CardTitle>
                <CardDescription>
                  {selectedSessionId === "all"
                    ? "Recent screenshot captures for this intern"
                    : "Screenshots captured during this work session"}
                </CardDescription>
              </div>
              {selectedSessionId === "all" && (
                <Link to="/admin/screenshots">
                  <Button variant="ghost" size="sm">
                    View all gallery
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {user.screenshots && user.screenshots.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {user.screenshots.slice(0, 12).map((shot: any) => (
                    <button
                      key={shot.id}
                      onClick={() => setPreviewScreenshot(shot)}
                      className="group overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="relative aspect-video">
                        <img
                          src={shot.cloudinary_url || `http://localhost:5000/${shot.file_path}`}
                          alt={shot.app_name}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {shot.captured_at ? shot.captured_at.slice(11, 16) : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="flex items-center gap-1.5 text-xs font-medium truncate max-w-[100px]">
                          <AppWindow className="h-3.5 w-3.5 text-muted-foreground" />
                          {shot.app_name}
                        </span>
                        <span
                          className="text-xs font-semibold tabular-nums"
                          style={{
                            color:
                              shot.activity >= 70
                                ? "oklch(0.55 0.15 150)"
                                : shot.activity >= 40
                                ? "oklch(0.6 0.13 65)"
                                : "oklch(0.6 0.2 25)",
                          }}
                        >
                          {shot.activity}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No screenshots recorded for this period.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work Session History</CardTitle>
              <CardDescription>Details of previous tracking sessions (click a session to inspect details)</CardDescription>
            </CardHeader>
            <CardContent>
              {user.sessions && user.sessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                        <th className="py-2">Date</th>
                        <th className="py-2">Start Time</th>
                        <th className="py-2">End Time</th>
                        <th className="py-2 text-right">Active</th>
                        <th className="py-2 text-right">Idle</th>
                        <th className="py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.sessions.map((sess: any) => {
                        const dateStr = sess.start_time ? sess.start_time.slice(0, 10) : "-"
                        const startStr = sess.start_time ? sess.start_time.slice(11, 19) : "-"
                        const endStr = sess.end_time ? sess.end_time.slice(11, 19) : (sess.status === "active" ? "Running..." : "-")
                        const isSelected = sess.id === selectedSessionId
                        return (
                          <tr
                            key={sess.id}
                            onClick={() => setSelectedSessionId(isSelected ? "all" : sess.id)}
                            className={`border-b border-border last:border-0 hover:bg-secondary/20 cursor-pointer ${
                              isSelected ? "bg-primary/10 hover:bg-primary/15 font-semibold" : ""
                            }`}
                          >
                            <td className="py-2.5 font-medium">{dateStr}</td>
                            <td className="py-2.5">{startStr}</td>
                            <td className="py-2.5">{endStr}</td>
                            <td className="py-2.5 text-right font-mono">{sess.active_minutes}m</td>
                            <td className="py-2.5 text-right font-mono">{sess.idle_minutes}m</td>
                            <td className="py-2.5 text-right">
                              <Badge variant={sess.status === "active" ? "success" : sess.status === "paused" ? "warning" : "neutral"}>
                                {sess.status.toLowerCase()}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tracking sessions recorded.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assigned Tasks</CardTitle>
              <CardDescription>Tasks created for this intern</CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {tasks.map((t) => (
                    <li key={t._id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-semibold">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{t.project} · {t.estimate}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={t.priority === "High" ? "danger" : t.priority === "Medium" ? "warning" : "neutral"}>
                          {t.priority}
                        </Badge>
                        <Badge variant="neutral">{t.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length > 0 ? (
                <ul className="flex flex-col gap-4">
                  {activity.map((e) => (
                    <li key={e.id} className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{e.action}</p>
                        <p className="truncate text-xs text-muted-foreground">{e.detail}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{e.time}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Screenshot Preview modal */}
      {previewScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreviewScreenshot(null)}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={user.name} color={user.avatarColor} size={32} />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{previewScreenshot.app_name} · {previewScreenshot.captured_at ? previewScreenshot.captured_at.slice(11, 19) : ""}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewScreenshot(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="aspect-video">
              <img
                  src={previewScreenshot.cloudinary_url || `http://localhost:5000/${previewScreenshot.file_path}`}
                  alt={previewScreenshot.app_name}
                  className="h-full w-full object-cover"
              />
            </div>
            <div className="flex items-center gap-6 px-5 py-3 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-4 w-4" />
                Activity level
                <span className="font-semibold text-foreground">{previewScreenshot.activity}%</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                Captured at <span className="font-semibold text-foreground">{previewScreenshot.captured_at ? previewScreenshot.captured_at.slice(11, 19) : ""}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
