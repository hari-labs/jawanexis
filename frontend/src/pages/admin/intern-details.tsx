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
  const [activeTab, setActiveTab] = useState<"today" | "overall">("today")

  const todayPrefix = new Date().toISOString().slice(0, 10)
  const todayActivity = recentActivity.filter(
    (e) => e.internId === id && e.time && e.time.includes(todayPrefix)
  )

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
  
  let scopeLabel = "All Time"
  if (selectedSessionId === "today") {
    scopeLabel = "Today"
  } else if (selectedSessionId === "week") {
    scopeLabel = "Week"
  } else if (selectedSessionId !== "all") {
    scopeLabel = "Selected Session"
  }

  const infoItems = [
    { icon: Mail, label: "Email", value: user.email },
    { icon: MapPin, label: "Timezone", value: user.timezone || "IST" },
    { icon: Calendar, label: "Joined", value: user.joinedDate || "-" },
  ]

  const scopeMetrics = [
    { icon: Clock, label: `Tracked Time`, value: fmtDuration((user.scope_tracked_mins || 0) * 60), raw: `${user.scope_tracked_mins || 0}m` },
    { icon: Activity, label: `Active Time`, value: fmtDuration((user.scope_active_mins || 0) * 60), raw: `${user.scope_active_mins || 0}m` },
    { icon: Coffee, label: `Idle Time`, value: fmtDuration((user.scope_idle_mins || 0) * 60), raw: `${user.scope_idle_mins || 0}m` },
    { icon: Clock, label: `Locked Time`, value: fmtDuration((user.scope_locked_mins || 0) * 60), raw: `${user.scope_locked_mins || 0}m` },
    { icon: Clock, label: `Productive Time`, value: fmtDuration((user.scope_productive_mins || 0) * 60), raw: `${user.scope_productive_mins || 0}m` },
    { icon: Clock, label: `Neutral Time`, value: fmtDuration((user.scope_neutral_mins || 0) * 60), raw: `${user.scope_neutral_mins || 0}m` },
    { icon: Clock, label: `Unproductive Time`, value: fmtDuration((user.scope_unproductive_mins || 0) * 60), raw: `${user.scope_unproductive_mins || 0}m` },
    { icon: Gauge, label: `Efficiency Ratio`, value: `${user.scope_efficiency || 0}%`, raw: "" },
    { icon: Gauge, label: `Activity Ratio`, value: `${user.scope_activity_ratio || 0}%`, raw: "" },
    { icon: Gauge, label: `Productivity Score`, value: `${user.scope_productivity || 0}%`, raw: "" },
  ]

  const liveTelemetry = [
    { icon: Clock, label: "Today's work time", value: fmtDuration((user.today_work_mins || 0) * 60) },
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
                {selectedSessionId === "today" ? (
                  <span>Viewing stats for <strong>Today&apos;s Summary</strong></span>
                ) : (
                  <span>
                    Viewing stats for session starting on{" "}
                    <strong>
                      {(() => {
                        const activeSess = user.sessions?.find((s: any) => s.id === selectedSessionId)
                        return activeSess ? `${activeSess.start_time.slice(0, 10)} at ${activeSess.start_time.slice(11, 19)}` : "Selected Session"
                      })()}
                    </strong>
                  </span>
                )}
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
              <CardTitle>Scope details ({scopeLabel})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {scopeMetrics.map((m) => (
                <div key={m.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <m.icon className="h-4 w-4" />
                    {m.label}
                  </span>
                  <span className="truncate text-sm font-medium font-mono text-right">
                    {m.value} {m.raw && <span className="text-[10px] text-muted-foreground ml-1">({m.raw})</span>}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Real-time activity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {liveTelemetry.map((m) => (
                <div key={m.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <m.icon className="h-4 w-4" />
                    {m.label}
                  </span>
                  <span className="truncate text-sm font-medium text-right">{m.value}</span>
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
          {/* Session Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-secondary/15 p-4 rounded-xl border border-border">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-foreground">Filter by Work Session</h3>
              <p className="text-xs text-muted-foreground">Select a specific session or view cumulative history.</p>
            </div>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="h-10 w-full sm:w-80 rounded-lg border border-border bg-card px-3 text-xs font-semibold focus:border-ring outline-none"
            >
              <option value="all">All Sessions (All-Time Cumulative)</option>
              <option value="today">☀️ Today&apos;s Summary (Cumulative)</option>
              <option value="week">📅 This Week (Cumulative)</option>
              {user.sessions?.map((sess: any) => {
                const start = new Date(sess.start_time)
                const dateStr = start.toLocaleDateString()
                const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                const dur = sess.end_time 
                  ? fmtDuration((sess.active_minutes + sess.idle_minutes) * 60)
                  : "Active Now"
                const indicator = sess.status.toUpperCase() === "ACTIVE" ? "🟢" : "⚫"
                return (
                  <option key={sess.id} value={sess.id}>
                    {indicator} {dateStr} at {timeStr} ({dur})
                  </option>
                )
              })}
            </select>
          </div>

          {/* Tab Selector */}
          <div className="flex gap-2 border-b border-border pb-3">
            <button
              onClick={() => setActiveTab("today")}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                activeTab === "today" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              Today&apos;s Performance
            </button>
            <button
              onClick={() => setActiveTab("overall")}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                activeTab === "overall" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              Overall &amp; Historical Profile
            </button>
          </div>

          {activeTab === "today" ? (
            <div className="flex flex-col gap-4">
              {/* Today's Metrics Grid */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center">
                    <p className="text-xs text-muted-foreground font-medium text-center">Today&apos;s Productivity</p>
                    <p className="text-2xl font-bold text-primary mt-1">{user.productivityToday || 0}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center">
                    <p className="text-xs text-muted-foreground font-medium text-center">Today&apos;s Active Time</p>
                    <p className="text-2xl font-bold mt-1">{fmtDuration((user.today_active_mins || 0) * 60)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center">
                    <p className="text-xs text-muted-foreground font-medium text-center">Today&apos;s Idle Time</p>
                    <p className="text-2xl font-bold mt-1">{fmtDuration((user.today_idle_mins || 0) * 60)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center">
                    <p className="text-xs text-muted-foreground font-medium text-center">Today&apos;s Locked Time</p>
                    <p className="text-2xl font-bold mt-1">{fmtDuration((user.today_locked_mins || 0) * 60)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center">
                    <p className="text-xs text-muted-foreground font-medium text-center">Today&apos;s Working Hours</p>
                    <p className="text-2xl font-bold mt-1">{fmtDuration((user.today_work_mins || 0) * 60)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Today's Trends & Detailed Score Breakdown */}
              {(() => {
                const todaySessions = user.sessions?.filter((s: any) => s.start_time && s.start_time.includes(todayPrefix)) || []
                const todayTrendData = todaySessions.map((s: any) => ({
                  time: s.start_time ? new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Unknown",
                  productivity: s.productivity || 0
                })).reverse()

                return (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card className="md:col-span-2">
                      <CardHeader>
                        <CardTitle>Today&apos;s Productivity Trend</CardTitle>
                        <CardDescription>Productivity score per session today</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-48">
                          {todayTrendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={todayTrendData} margin={{ left: -20, right: 8, top: 8 }}>
                                <defs>
                                  <linearGradient id="todayArea" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                <XAxis dataKey="time" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 13 }} />
                                <Area type="monotone" dataKey="productivity" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#todayArea)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <p className="text-sm text-muted-foreground">No sessions today.</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Today&apos;s Score Breakdown</CardTitle>
                        <CardDescription>Detailed today performance telemetry</CardDescription>
                      </CardHeader>
                      <CardContent className="text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Productive Time:</span>
                          <span className="font-semibold text-foreground">{user.today_productive_mins || 0}m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Neutral Time:</span>
                          <span className="font-semibold text-foreground">{user.today_neutral_mins || 0}m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Unproductive Time:</span>
                          <span className="font-semibold text-foreground text-destructive">{user.today_unproductive_mins || 0}m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Idle Time:</span>
                          <span className="font-semibold text-foreground">{user.today_idle_mins || 0}m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Locked Time:</span>
                          <span className="font-semibold text-foreground">{user.today_locked_mins || 0}m</span>
                        </div>
                        <div className="flex justify-between border-t border-border/40 pt-2">
                          <span className="text-muted-foreground">Efficiency Ratio:</span>
                          <span className="font-semibold text-foreground">{user.today_efficiency || 0}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Activity Ratio:</span>
                          <span className="font-semibold text-foreground">{user.today_activity_ratio || 0}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })()}

              {/* Today Used Apps and Sites */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Today Used Applications</CardTitle>
                    <CardDescription>Time spent per application today</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {user.today_apps && user.today_apps.length > 0 ? (
                      user.today_apps.map((app: any) => (
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
                      <p className="text-sm text-muted-foreground">No application usage recorded today.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Today Used Websites</CardTitle>
                    <CardDescription>Time spent per domain today</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {user.today_sites && user.today_sites.length > 0 ? (
                      user.today_sites.map((site: any) => (
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
                      <p className="text-sm text-muted-foreground">No website visits recorded today.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Today's Productive, Neutral, Unproductive Apps */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Today&apos;s Productive Apps</CardTitle>
                    <CardDescription>Productive tools used today</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {user.today_apps && user.today_apps.filter((a: any) => a.category === "productive").length > 0 ? (
                      user.today_apps.filter((a: any) => a.category === "productive").map((app: any) => (
                        <div key={app.name} className="flex justify-between items-center text-sm border-b border-border/40 pb-1.5 last:border-0">
                          <span className="font-medium truncate max-w-[150px]">{app.name}</span>
                          <span className="text-muted-foreground text-xs">{fmtDuration(app.duration)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No productive apps recorded today.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Today&apos;s Neutral Apps</CardTitle>
                    <CardDescription>Neutral applications used today</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {user.today_apps && user.today_apps.filter((a: any) => a.category === "neutral").length > 0 ? (
                      user.today_apps.filter((a: any) => a.category === "neutral").map((app: any) => (
                        <div key={app.name} className="flex justify-between items-center text-sm border-b border-border/40 pb-1.5 last:border-0">
                          <span className="font-medium truncate max-w-[150px]">{app.name}</span>
                          <span className="text-muted-foreground text-xs">{fmtDuration(app.duration)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No neutral apps recorded today.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Today&apos;s Unproductive Apps</CardTitle>
                    <CardDescription>Distracting applications used today</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {user.today_apps && user.today_apps.filter((a: any) => a.category === "distracting" || a.category === "unproductive").length > 0 ? (
                      user.today_apps.filter((a: any) => a.category === "distracting" || a.category === "unproductive").map((app: any) => (
                        <div key={app.name} className="flex justify-between items-center text-sm border-b border-border/40 pb-1.5 last:border-0">
                          <span className="font-medium truncate max-w-[150px] text-destructive">{app.name}</span>
                          <span className="text-muted-foreground text-xs">{fmtDuration(app.duration)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No unproductive apps recorded today.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Today's Productive, Neutral, Unproductive Websites */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Today&apos;s Productive Websites</CardTitle>
                    <CardDescription>Productive domains visited today</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {user.today_sites && user.today_sites.filter((s: any) => s.category === "productive").length > 0 ? (
                      user.today_sites.filter((s: any) => s.category === "productive").map((site: any) => (
                        <div key={site.domain} className="flex justify-between items-center text-sm border-b border-border/40 pb-1.5 last:border-0">
                          <span className="font-medium truncate max-w-[150px]">{site.domain}</span>
                          <span className="text-muted-foreground text-xs">{fmtDuration(site.duration)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No productive sites recorded today.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Today&apos;s Neutral Websites</CardTitle>
                    <CardDescription>Neutral domains visited today</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {user.today_sites && user.today_sites.filter((s: any) => s.category === "neutral").length > 0 ? (
                      user.today_sites.filter((s: any) => s.category === "neutral").map((site: any) => (
                        <div key={site.domain} className="flex justify-between items-center text-sm border-b border-border/40 pb-1.5 last:border-0">
                          <span className="font-medium truncate max-w-[150px]">{site.domain}</span>
                          <span className="text-muted-foreground text-xs">{fmtDuration(site.duration)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No neutral sites recorded today.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Today&apos;s Unproductive Websites</CardTitle>
                    <CardDescription>Distracting domains visited today</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {user.today_sites && user.today_sites.filter((s: any) => s.category === "distracting" || s.category === "unproductive").length > 0 ? (
                      user.today_sites.filter((s: any) => s.category === "distracting" || s.category === "unproductive").map((site: any) => (
                        <div key={site.domain} className="flex justify-between items-center text-sm border-b border-border/40 pb-1.5 last:border-0">
                          <span className="font-medium truncate max-w-[150px] text-destructive">{site.domain}</span>
                          <span className="text-muted-foreground text-xs">{fmtDuration(site.duration)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No unproductive sites recorded today.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Today's Screenshots */}
              <Card>
                <CardHeader>
                  <CardTitle>Today&apos;s Screenshots</CardTitle>
                  <CardDescription>Screenshots captured today</CardDescription>
                </CardHeader>
                <CardContent>
                  {user.today_screenshots && user.today_screenshots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {user.today_screenshots.map((shot: any) => (
                        <button
                          key={shot.id}
                          onClick={() => setPreviewScreenshot(shot)}
                          className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md text-left"
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
                            <span className="text-xs font-semibold tabular-nums text-primary">{shot.activity}%</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No screenshots captured today.</p>
                  )}
                </CardContent>
              </Card>

              {/* Today's Activity Feed */}
              <Card>
                <CardHeader>
                  <CardTitle>Today&apos;s Activity Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {todayActivity.length > 0 ? (
                    <ul className="flex flex-col gap-4">
                      {todayActivity.map((e) => (
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
                    <p className="text-sm text-muted-foreground">No activity recorded today.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Productivity this week */}
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

              {/* Apps and sites overall */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {selectedSessionId === "all"
                        ? "Application Usage (All Time)"
                        : "Session Applications"}
                    </CardTitle>
                    <CardDescription>
                      {selectedSessionId === "all"
                        ? "Cumulative time spent per application"
                        : "Time spent per application in this session"}
                    </CardDescription>
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
                      <p className="text-sm text-muted-foreground">
                        No application usage recorded{" "}
                        {selectedSessionId === "all" ? "across all sessions" : "during this session"}.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      {selectedSessionId === "all"
                        ? "Website Usage (All Time)"
                        : "Session Websites"}
                    </CardTitle>
                    <CardDescription>
                      {selectedSessionId === "all"
                        ? "Cumulative time spent per domain"
                        : "Time spent per domain in this session"}
                    </CardDescription>
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
                      <p className="text-sm text-muted-foreground">
                        No website visits recorded{" "}
                        {selectedSessionId === "all" ? "across all sessions" : "during this session"}.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Historical Screenshots */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>
                      {selectedSessionId === "all"
                        ? "Screenshots (All Time)"
                        : "Session Screenshots"}
                    </CardTitle>
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
                            <span className="text-xs font-semibold tabular-nums text-primary">{shot.activity}%</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No screenshots recorded for this period.</p>
                  )}
                </CardContent>
              </Card>

              {/* Work Session History */}
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
                          <tr
                            onClick={() => setSelectedSessionId(selectedSessionId === "today" ? "all" : "today")}
                            className={`border-b border-border hover:bg-secondary/20 cursor-pointer ${
                              selectedSessionId === "today" ? "bg-primary/10 hover:bg-primary/15 font-semibold" : ""
                            }`}
                          >
                            <td className="py-2.5 font-medium text-primary flex items-center gap-1.5" colSpan={3}>
                              ☀️ Today&apos;s Summary (Cumulative)
                            </td>
                            <td className="py-2.5 text-right font-mono">{(user.today_active_mins || 0).toFixed(0)}m</td>
                            <td className="py-2.5 text-right font-mono">{(user.today_idle_mins || 0).toFixed(0)}m</td>
                            <td className="py-2.5 text-right">
                              <Badge variant="success">today</Badge>
                            </td>
                          </tr>
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

              {/* Assigned Tasks */}
              <Card>
                <CardHeader>
                  <CardTitle>Assigned Tasks</CardTitle>
                  <CardDescription>Tasks created for this intern</CardDescription>
                </CardHeader>
                <CardContent>
                  {id && tasks.filter(t => t.assigned_to === id).length > 0 ? (
                    <ul className="flex flex-col gap-3">
                      {tasks.filter(t => t.assigned_to === id).map((t) => (
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

              {/* Recent activity */}
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
          )}
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
