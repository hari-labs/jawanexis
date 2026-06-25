import { useEffect, useState } from "react"
import {
  getUsers,
  toggleUserActive,
  changeUserRole,
  deleteUser,
  getInternSummary,
  getAssignedProjects,
  getAllTasks,
  getAllEvidence,
  getAllMonitoringStatus,
  categoryColor
} from "@/services/api"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { PageHeader } from "@/components/page-header"
import {
  UserCheck,
  ShieldAlert,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  ArrowLeft,
  Clock,
  Activity,
  Coffee,
  Gauge,
  Calendar,
  ListTodo,
  FileText,
  Download,
  Folder,
  User,
  Zap,
  Target,
  Camera
} from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts"

function fmt(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtSec(sec: number) {
  return fmt(Math.round(sec / 60))
}

function UserAnalyticsView({ user, summary, projects, tasks, evidence, allUsers, allMonitoring, onBack }: {
  user: any;
  summary: any;
  projects: any[];
  tasks: any[];
  evidence: any[];
  allUsers: any[];
  allMonitoring: any[];
  onBack: () => void;
}) {
  const [localSummary, setLocalSummary] = useState<any>(summary)
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all")
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false)

  const handleSessionChange = async (sessId: string) => {
    setSelectedSessionId(sessId)
    setLoadingSummary(true)
    try {
      const res = await getInternSummary(user.id, sessId)
      setLocalSummary(res)
    } catch (e) {
      console.error("Failed to load session summary", e)
    } finally {
      setLoadingSummary(false)
    }
  }

  const isTeamLead = user.role.toLowerCase() === "team_lead" || user.role.toLowerCase() === "team lead"
  const isIntern = user.role.toLowerCase() === "intern"

  // Intern calculations
  const internTasks = user.id ? tasks.filter(t => t.assigned_to === user.id) : []
  const internEvidence = user.id ? evidence.filter(ev => 
    ev.uploaded_by === user.id || 
    ev.user_id === user.id ||
    ev.employee_id === user.id
  ) : []
  const totalTasks = internTasks.length
  const completedTasks = internTasks.filter(t => t.status === "Completed" || t.status === "Approved").length
  const rejectedTasks = internTasks.filter(t => t.status === "Rejected").length
  const pendingReviews = internTasks.filter(t => t.status === "Under Review").length
  const taskCompletionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Team Lead calculations
  const ledProjects = projects.filter(p => p.lead_id === user.id)
  const managedMemberIds = Array.from(new Set(ledProjects.flatMap(p => p.member_ids || [])))
  const managedMembers = allUsers.filter(u => managedMemberIds.includes(u.id))
  const teamProductivity = managedMembers.length > 0
    ? Math.round(managedMembers.reduce((acc, m) => acc + (m.productivity || 0), 0) / managedMembers.length)
    : 0
  const activeMonitoredCount = allMonitoring.filter(m => managedMemberIds.includes(m.user_id) && m.current_state === "RUNNING").length

  // User summary metrics
  const apps = localSummary?.apps || []
  const sites = localSummary?.sites || []
  const screenshots = localSummary?.screenshots || []
  const sessions = localSummary?.sessions || []

  const appUsage = apps.map((a: any) => ({
    name: a.name,
    minutes: Math.round(a.duration / 60),
    category: a.category || "productive"
  }))

  const siteUsage = sites.map((s: any) => ({
    domain: s.domain,
    minutes: Math.round(s.duration / 60),
    category: s.category || "productive"
  }))

  const appMax = appUsage.length > 0 ? Math.max(...appUsage.map((a: any) => a.minutes)) : 1
  const siteMax = siteUsage.length > 0 ? Math.max(...siteUsage.map((s: any) => s.minutes)) : 1
  const chartData = [...appUsage].sort((a: any, b: any) => b.minutes - a.minutes).slice(0, 6)

  // Group screenshots by hour
  const groupedShots: { [key: string]: any[] } = {}
  screenshots.forEach((shot: any) => {
    const timeStr = shot.captured_at ? new Date(shot.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Unknown"
    let hourStr = "Unknown Time"
    if (shot.captured_at) {
      const dt = new Date(shot.captured_at)
      const hrs = dt.getHours()
      const ampm = hrs >= 12 ? 'PM' : 'AM'
      const hrs12 = hrs % 12 || 12
      hourStr = `${hrs12}:00 ${ampm}`
    }
    
    if (!groupedShots[hourStr]) {
      groupedShots[hourStr] = []
    }
    groupedShots[hourStr].push({
      id: shot.id,
      file_path: shot.file_path,
      app: shot.app_name,
      time: timeStr,
      activity: shot.activity
    })
  })
  
  const screenshotHours = Object.keys(groupedShots).map(hour => ({
    hour,
    shots: groupedShots[hour]
  }))

  const userMonitoring = allMonitoring.find(m => m.user_id === user.id) || {
    agent_online: false,
    current_state: "IDLE",
    last_seen: null,
    elapsed_seconds: 0
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="icon" onClick={onBack} className="h-9 w-9 rounded-lg">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant={isTeamLead ? "primary" : isIntern ? "neutral" : "success"} className="ml-2 uppercase font-extrabold text-[10px]">
          {isTeamLead ? "Team Lead" : isIntern ? "Intern" : "Admin"}
        </Badge>
        
        {/* Agent Connection Badge */}
        <Badge variant={userMonitoring.agent_online ? "success" : "danger"} className="text-[10px] font-bold">
          {userMonitoring.agent_online ? "Agent Online" : "Agent Offline"}
        </Badge>

        {/* Monitoring State Badge */}
        <Badge variant={userMonitoring.current_state === "RUNNING" ? "success" : userMonitoring.current_state === "PAUSED" ? "warning" : "neutral"} className="text-[10px] font-bold uppercase">
          State: {userMonitoring.current_state}
        </Badge>

        {/* Elapsed duration */}
        {userMonitoring.elapsed_seconds > 0 && (
          <span className="text-xs font-mono font-bold bg-secondary/60 px-2 py-0.5 rounded text-foreground">
            Session: {fmtSec(userMonitoring.elapsed_seconds)}
          </span>
        )}

        {/* Last Seen */}
        {userMonitoring.last_seen && (
          <span className="text-xs text-muted-foreground">
            Last Seen: {new Date(userMonitoring.last_seen).toLocaleString()}
          </span>
        )}
      </div>

      {/* METRICS SUMMARY */}
      {isIntern && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded bg-primary/10 text-primary">
                <Folder className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Projects</p>
                <p className="text-base font-black">{projects.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded bg-slate-100 text-slate-600">
                <ListTodo className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Tasks Assigned</p>
                <p className="text-base font-black">{totalTasks}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded bg-success/10 text-success">
                <Target className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Completion</p>
                <p className="text-base font-black text-success">{taskCompletionPct}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded bg-warning/10 text-warning">
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Hours Done</p>
                <p className="text-base font-black">{localSummary ? `${localSummary.workHours}h` : "-"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded bg-danger/10 text-danger">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Rejected Tasks</p>
                <p className="text-base font-black text-danger">{rejectedTasks}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isTeamLead && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded bg-primary/10 text-primary">
                <Folder className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Led Projects</p>
                <p className="text-base font-black">{projects.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded bg-success/10 text-success">
                <User className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Managed Team</p>
                <p className="text-base font-black">{managedMembers.length} Members</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded bg-primary/15 text-primary">
                <Gauge className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Team Productivity</p>
                <p className="text-base font-black text-primary">{teamProductivity}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded bg-warning/10 text-warning">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Active Monitored</p>
                <p className="text-base font-black text-warning">{activeMonitoredCount} / {managedMembers.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TEAM LEAD DRILL-DOWN PROJECTS & MEMBERS LIST */}
      {isTeamLead && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Projects</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[300px] overflow-y-auto pr-1">
              <ul className="flex flex-col gap-3">
                {ledProjects.map(proj => (
                  <li key={proj.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{proj.name}</p>
                      <p className="text-xs text-muted-foreground">{proj.start_date || "-"} to {proj.end_date || "Continuous"}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="neutral" className="text-[10px]">{proj.members?.length || 0} Members</Badge>
                      <p className="text-xs font-bold text-primary mt-1">{proj.progress || 0}% Progress</p>
                    </div>
                  </li>
                ))}
                {ledProjects.length === 0 && (
                  <p className="text-xs text-muted-foreground italic text-center py-6">No projects assigned as lead.</p>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Managed Team Members & Monitoring Status</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[300px] overflow-y-auto pr-1">
              <ul className="flex flex-col gap-3">
                {managedMembers.map(m => {
                  const mState = allMonitoring.find(state => state.user_id === m.id)
                  const mOnline = mState?.agent_online
                  return (
                    <li key={m.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                      <div className="min-w-0 flex items-center gap-2">
                        <Avatar name={m.name} color={m.avatarColor} size={28} />
                        <div className="leading-tight">
                          <p className="font-semibold text-sm truncate">{m.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={mOnline ? "success" : "neutral"} className="text-[9px] px-1 py-0 font-extrabold uppercase">
                            {mOnline ? "Online" : "Offline"}
                          </Badge>
                          <Badge variant={mState?.current_state === "RUNNING" ? "success" : mState?.current_state === "PAUSED" ? "warning" : "neutral"} className="text-[9px] px-1 py-0 font-extrabold uppercase">
                            {mState?.current_state || "STOPPED"}
                          </Badge>
                        </div>
                        <p className="text-xs font-bold text-primary">{m.productivity || 0}% Prod</p>
                      </div>
                    </li>
                  )
                })}
                {managedMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground italic text-center py-6">No members under projects managed.</p>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* INTERN DRILL-DOWN PROJECTS & TASKS */}
      {isIntern && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Assigned Projects */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Assigned Projects ({projects.length})</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[300px] overflow-y-auto pr-1">
              <ul className="flex flex-col gap-3">
                {projects.map(proj => (
                  <li key={proj.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{proj.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{proj.description || "No description"}</p>
                    </div>
                  </li>
                ))}
                {projects.length === 0 && (
                  <p className="text-xs text-muted-foreground italic text-center py-6">No projects assigned.</p>
                )}
              </ul>
            </CardContent>
          </Card>

          {/* Assigned Tasks */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Assigned Tasks ({totalTasks})</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[300px] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {internTasks.map(t => (
                  <Card key={t._id} className="border border-border/80 bg-secondary/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={t.priority === "High" ? "danger" : t.priority === "Medium" ? "warning" : "neutral"} className="text-[9px]">
                          {t.priority}
                        </Badge>
                        <Badge variant={t.status === "Approved" ? "success" : t.status === "Rejected" ? "danger" : t.status === "Under Review" ? "warning" : "neutral"} className="text-[9px] font-bold">
                          {t.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-sm mt-2">{t.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-[11px] text-muted-foreground space-y-1">
                      <p className="line-clamp-2">{t.description || "No description provided."}</p>
                      <p className="font-semibold text-foreground pt-1.5">Due: {t.due_date || "Continuous"}</p>
                    </CardContent>
                  </Card>
                ))}
                {totalTasks === 0 && (
                  <p className="text-xs text-muted-foreground italic text-center py-10 col-span-2">No tasks assigned.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ACTIVITY & PRODUCTIVITY ANALYTICS */}
      {localSummary ? (
        <>
          {/* Session Selector Dropdown */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">Interactive Session Drilling</p>
                <p className="text-xs text-muted-foreground">Select a session to filter productivity, apps, websites, and timeline screenshots below.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-muted-foreground uppercase">Session:</span>
                <select
                  value={selectedSessionId}
                  onChange={(e) => handleSessionChange(e.target.value)}
                  disabled={loadingSummary}
                  className="bg-background border border-border rounded px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none min-w-[200px]"
                >
                  <option value="all">All Sessions (Overall Recent)</option>
                  <option value="today">Today&apos;s Summary</option>
                  {sessions.map((sess: any) => (
                    <option key={sess.id} value={sess.id}>
                      {new Date(sess.start_time).toLocaleString()} ({sess.status})
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mt-4">
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">Tracked Time</p>
                  <p className="text-lg font-bold mt-0.5">{fmt(localSummary.total_work_mins || 0)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <Activity className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">Active Time</p>
                  <p className="text-lg font-bold mt-0.5">{fmt(localSummary.total_active_mins || 0)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                  <Coffee className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">Idle Time</p>
                  <p className="text-lg font-bold mt-0.5">{fmt(localSummary.total_idle_mins || 0)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Gauge className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">Productivity</p>
                  <p className="text-lg font-bold mt-0.5 text-primary">{localSummary.productivity || 0}%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {loadingSummary ? (
            <div className="py-12 text-center text-sm font-semibold text-muted-foreground">
              Filtering session aggregates...
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                  <CardHeader className="flex-row items-center justify-between">
                    <div>
                      <CardTitle>Time by application</CardTitle>
                      <CardDescription>Top application usage durations</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ left: -20, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: "var(--color-popover)",
                            border: "1px solid var(--color-border)",
                            fontSize: 12,
                          }}
                          formatter={(v: any) => fmt(Number(v))}
                        />
                        <Bar dataKey="minutes" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Activity Analytics metrics card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Analytics</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-6 py-6">
                    <div className="flex items-center justify-center gap-3">
                      <div className="relative flex items-center justify-center h-28 w-28 rounded-full border-8 border-primary/20">
                        <span className="text-2xl font-black text-primary">{localSummary.productivity}%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-center border-t border-border pt-4">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Productive Time</p>
                        <p className="text-sm font-black text-success mt-0.5">{fmt(localSummary.total_active_mins)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Idle Time</p>
                        <p className="text-sm font-black text-warning mt-0.5">{fmt(localSummary.total_idle_mins)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader className="flex-row items-center justify-between">
                    <div>
                      <CardTitle>Time by website</CardTitle>
                      <CardDescription>Top website visit durations</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={siteUsage.sort((a: any, b: any) => b.minutes - a.minutes).slice(0, 6)} margin={{ left: -20, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="domain" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: "var(--color-popover)",
                            border: "1px solid var(--color-border)",
                            fontSize: 12,
                          }}
                          formatter={(v: any) => fmt(Number(v))}
                        />
                        <Bar dataKey="minutes" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="md:col-span-1 bg-transparent border-none shadow-none" />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {selectedSessionId === "all"
                        ? "Applications Used (All Time)"
                        : selectedSessionId === "today"
                        ? "Today's Applications"
                        : "Session Applications"}{" "}
                      ({localSummary.app_count})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3.5 max-h-[300px] overflow-y-auto">
                    {appUsage.map((a: any, idx: number) => (
                      <div key={`${a.name}-${idx}`} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="truncate max-w-[70%] text-foreground">{a.name}</span>
                          <span className="text-muted-foreground">{fmt(a.minutes)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(a.minutes / appMax) * 100}%`, backgroundColor: categoryColor(a.category) }} />
                        </div>
                      </div>
                    ))}
                    {appUsage.length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-6">
                        No application usage recorded{" "}
                        {selectedSessionId === "all"
                          ? "across all sessions"
                          : selectedSessionId === "today"
                          ? "today"
                          : "during this session"}
                        .
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      {selectedSessionId === "all"
                        ? "Websites Visited (All Time)"
                        : selectedSessionId === "today"
                        ? "Today's Websites"
                        : "Session Websites"}{" "}
                      ({localSummary.site_count})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3.5 max-h-[300px] overflow-y-auto">
                    {siteUsage.map((s: any, idx: number) => (
                      <div key={`${s.domain}-${idx}`} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="truncate max-w-[70%] text-foreground">{s.domain}</span>
                          <span className="text-muted-foreground">{fmt(s.minutes)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(s.minutes / siteMax) * 100}%`, backgroundColor: categoryColor(s.category) }} />
                        </div>
                      </div>
                    ))}
                    {siteUsage.length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-6">
                        No website visits recorded{" "}
                        {selectedSessionId === "all"
                          ? "across all sessions"
                          : selectedSessionId === "today"
                          ? "today"
                          : "during this session"}
                        .
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* SCREENSHOTS */}
              <Card>
                <CardHeader>
                  <CardTitle>Screenshots Timeline ({localSummary.screenshot_count})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {screenshotHours.map((group: any) => (
                    <div key={group.hour} className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{group.hour}</p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {group.shots.map((shot: any) => (
                          <div key={shot.id} className="space-y-1.5">
                            <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-card">
                               {shot.cloudinary_url || shot.file_path ? (
                                <img
                                  src={shot.cloudinary_url || `http://localhost:5000/${shot.file_path}`}
                                  alt={shot.app}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full bg-secondary/35 flex items-center justify-center text-xs italic text-muted-foreground">No Capture</div>
                              )}
                            </div>
                            <div className="flex items-center justify-between px-0.5">
                              <span className="font-mono text-xs text-muted-foreground">{shot.time}</span>
                              <Badge variant={shot.activity > 60 ? "success" : "warning"} className="text-[9px]">
                                {shot.activity}% Act
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {screenshotHours.length === 0 && (
                    <p className="text-xs text-muted-foreground italic text-center py-10">No screenshots captured.</p>
                  )}
                </CardContent>
              </Card>

              {/* EVIDENCE HISTORY */}
              {isIntern && (
                <Card>
                  <CardHeader>
                    <CardTitle>Evidence History ({internEvidence.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[300px] overflow-y-auto pr-1">
                    <div className="space-y-4">
                      {internEvidence.map((ev) => (
                        <div key={ev._id} className="border border-border p-3.5 rounded-lg flex flex-col gap-2 bg-secondary/5">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-sm text-foreground">Task: {ev.task_title || "Task Deliverable"}</p>
                            <Badge variant={ev.status === "approved" ? "success" : ev.status === "rejected" ? "danger" : "warning"} className="text-[10px] capitalize">
                              {ev.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Notes: "{ev.notes || "No notes."}"</p>
                          {ev.review_comments && (
                            <div className="bg-secondary/40 border border-border/80 p-2.5 rounded text-xs mt-1 italic text-foreground">
                              Lead Feedback: "{ev.review_comments}"
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/20">
                            <span>Submitted: {ev.submitted_at ? new Date(ev.submitted_at).toLocaleString() : "-"}</span>
                            {ev.file_path && (
                              <a href={`http://localhost:5000/${ev.file_path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
                                <Download className="h-3 w-3" /> Download Deliverable
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                      {internEvidence.length === 0 && (
                        <p className="text-xs text-muted-foreground italic text-center py-6">No evidence deliverables submitted.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* WORK SESSIONS HISTORY */}
              <Card>
                <CardHeader>
                  <CardTitle>Monitored Work Sessions ({sessions.length})</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[300px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border pb-2 text-[10px] font-semibold text-muted-foreground uppercase">
                        <th className="py-2.5">Start Time</th>
                        <th className="py-2.5">End Time</th>
                        <th className="py-2.5">Active Time</th>
                        <th className="py-2.5">Idle Time</th>
                        <th className="py-2.5">Total Duration</th>
                        <th className="py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {sessions.map((sess: any) => {
                        const start = new Date(sess.start_time).toLocaleString()
                        const end = sess.end_time ? new Date(sess.end_time).toLocaleString() : "Active Session"
                        const activeM = sess.active_minutes || 0
                        const idleM = sess.idle_minutes || 0
                        const isCurrent = sess.status.toUpperCase() === "ACTIVE"
                        return (
                          <tr key={sess.id} className="hover:bg-secondary/15 transition-colors">
                            <td className="py-2.5 font-semibold text-foreground">
                              <div className="flex flex-col gap-0.5">
                                <span>{start}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {isCurrent ? "Current Session" : "Previous Session"}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 text-muted-foreground">{end}</td>
                            <td className="py-2.5 font-mono">{fmt(activeM)}</td>
                            <td className="py-2.5 font-mono">{fmt(idleM)}</td>
                            <td className="py-2.5 font-mono font-bold">{fmt(activeM + idleM)}</td>
                            <td className="py-2.5 text-right">
                              <Badge variant={isCurrent ? "success" : "neutral"} className="text-[9px] font-extrabold uppercase">
                                {sess.status}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                      {sessions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-muted-foreground italic">No work sessions recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground italic">
            No activity analytics recorded for this user yet.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function UsersList() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Analytics View states
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [userSummary, setUserSummary] = useState<any | null>(null)
  const [userProjects, setUserProjects] = useState<any[]>([])
  const [userTasks, setUserTasks] = useState<any[]>([])
  const [userEvidence, setUserEvidence] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [allMonitoring, setAllMonitoring] = useState<any[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")

  const loadUsers = () => {
    setLoading(true)
    Promise.all([getUsers(), getAllMonitoringStatus().catch(() => [])])
      .then(([usersData, monitoringData]) => {
        setUsers(usersData)
        setAllMonitoring(monitoringData)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUserAnalytics = async (user: any) => {
    setAnalyticsLoading(true)
    setSelectedUser(user)
    try {
      const [summary, projectsData, tasksData, evidenceData, usersData, monitoringData] = await Promise.all([
        getInternSummary(user.id),
        getAssignedProjects(user.id),
        getAllTasks(),
        getAllEvidence(user.id),
        getUsers(),
        getAllMonitoringStatus().catch(() => [])
      ])
      
      setUserSummary(summary)
      setUserProjects(projectsData)
      setUserTasks(tasksData)
      setUserEvidence(evidenceData)
      setAllUsers(usersData)
      setAllMonitoring(monitoringData)
    } catch (e) {
      console.error("Error loading user analytics", e)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const handleToggleActive = async (userId: string, name: string) => {
    try {
      const res = await toggleUserActive(userId)
      if (res.success) {
        alert(`User status for ${name} updated successfully!`)
        loadUsers()
      } else {
        alert(res.message || "Failed to toggle status.")
      }
    } catch (err) {
      alert("Error toggling status.")
    }
  }

  const handleChangeRole = async (userId: string, name: string, targetRole: string) => {
    if (!confirm(`Are you sure you want to change ${name}'s role to ${targetRole === "team_lead" ? "Team Lead" : "Intern"}?`)) {
      return
    }
    try {
      const res = await changeUserRole(userId, targetRole)
      if (res.success) {
        alert(`Role updated to ${targetRole === "team_lead" ? "Team Lead" : "Intern"} successfully!`)
        loadUsers()
      } else {
        alert(res.message || "Failed to change role.")
      }
    } catch (err) {
      alert("Error changing role.")
    }
  }

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`WARNING: Are you sure you want to permanently delete ${name}? This action is irreversible.`)) {
      return
    }
    try {
      const res = await deleteUser(userId)
      if (res.success) {
        alert("User deleted successfully!")
        loadUsers()
      } else {
        alert(res.message || "Failed to delete user.")
      }
    } catch (err) {
      alert("Error deleting user.")
    }
  }

  if (analyticsLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-lg font-semibold">Loading user analytics panel...</p>
      </div>
    )
  }

  if (selectedUser) {
    return (
      <UserAnalyticsView
        user={selectedUser}
        summary={userSummary}
        projects={userProjects}
        tasks={userTasks}
        evidence={userEvidence}
        allUsers={allUsers}
        allMonitoring={allMonitoring}
        onBack={() => {
          setSelectedUser(null)
          setUserSummary(null)
        }}
      />
    )
  }

  if (loading && users.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading users...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="User Management" description="Promote or demote roles, toggle account statuses, and manage access controls." />

      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>Manage Admins, Team Leads, and Interns. Click a user to view drill-down analytics.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isActive = u.is_active !== false
                  const isSelf = u.id === currentUser.id
                  const mState = allMonitoring.find(state => state.user_id === u.id)
                  const mOnline = mState?.agent_online
                  const mCurrentState = mState?.current_state || "IDLE"
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/5 cursor-pointer">
                      <td className="py-3 px-4 flex items-center gap-3 font-semibold text-foreground hover:underline" onClick={() => loadUserAnalytics(u)}>
                        <Avatar name={u.name} color={u.avatarColor} size={36} />
                        <span>{u.name}</span>
                        {isSelf && <Badge variant="primary" className="ml-2">You</Badge>}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground" onClick={() => loadUserAnalytics(u)}>{u.email}</td>
                      <td className="py-3 px-4" onClick={() => loadUserAnalytics(u)}>
                        <Badge variant={u.role === "admin" ? "success" : u.role === "team_lead" ? "primary" : "neutral"}>
                          {u.role === "admin" ? "Admin" : u.role === "team_lead" ? "Team Lead" : "Intern"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4" onClick={() => loadUserAnalytics(u)}>
                        <div className="flex flex-col gap-1">
                          <Badge variant={isActive ? "success" : "danger"} className="w-fit">
                            {isActive ? "Active" : "Deactivated"}
                          </Badge>
                          {mState && (
                            <div className="flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${mOnline ? "bg-success" : "bg-danger"}`} />
                              <span className="text-[9px] text-muted-foreground font-bold uppercase">
                                {mOnline ? "Online" : "Offline"} ({mCurrentState})
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isSelf && u.role !== "admin" ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleActive(u.id, u.name)}
                              className={isActive ? "text-amber-500 hover:bg-amber-500/10" : "text-emerald-500 hover:bg-emerald-500/10"}
                            >
                              {isActive ? "Deactivate" : "Activate"}
                            </Button>

                            {u.role === "intern" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleChangeRole(u.id, u.name, "team_lead")}
                                className="inline-flex items-center gap-1 text-primary hover:bg-primary/10"
                              >
                                <ArrowUpCircle className="h-4 w-4" />
                                Promote
                              </Button>
                            )}
                            {u.role === "team_lead" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleChangeRole(u.id, u.name, "intern")}
                                className="inline-flex items-center gap-1 text-slate-500 hover:bg-slate-500/10"
                              >
                                <ArrowDownCircle className="h-4 w-4" />
                                Demote
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleDelete(u.id, u.name)}
                              className="text-destructive hover:bg-destructive/10"
                              aria-label="Delete user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Restricted</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
