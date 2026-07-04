import { BASE_URL } from "@/services/api";
import { useEffect, useState, useRef } from "react"
import { Link } from "react-router-dom"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { Users, Activity, Gauge, Clock, Coffee, Zap, Play, Pause, Square, Target, ShieldAlert, ArrowRight, Circle, Calendar } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProductivityRing } from "@/components/productivity-ring"
import { MockScreenshot } from "@/components/mock-screenshot"
import {
  getUsers,
  getRecentActivity,
  getProductivityTrend,
  getAssignedProjects,
  getMonitoringStatus,
  getAllMonitoringStatus,
  sendMonitoringCommand,
  getInternSummary,
  getDashboardData
} from "@/services/api"

function fmt(min: number) {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function TeamLeadDashboard() {
  const [users, setUsers] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [productivityTrend, setProductivityTrend] = useState<any[]>([])
  const [assignedProjects, setAssignedProjects] = useState<any[]>([])
  const [allMonitoringStatuses, setAllMonitoringStatuses] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)

  // Team Lead's own monitoring status
  const [monitoringState, setMonitoringState] = useState<"RUNNING" | "PAUSED" | "STOPPED" | "IDLE" | "STARTING" | "PAUSING" | "RESUMING" | "STOPPING">("STOPPED")
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [agentOnline, setAgentOnline] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"team" | "personal">("team")
  const [personalProductivityTrend, setPersonalProductivityTrend] = useState<any[]>([])

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")

  const updateOwnStatus = (status: any) => {
    setMonitoringState(status.current_state || "STOPPED")
    setAgentOnline(status.agent_online || false)
    setSessionStartTime(status.started_at || null)
    setLastSeen(status.last_seen || null)
    const serverElapsed = status.elapsed_seconds || 0
    setElapsedSeconds((prev) => {
      if (status.current_state !== "RUNNING" || Math.abs(prev - serverElapsed) > 2 || prev === 0) {
        return serverElapsed
      }
      return prev
    })
  }

  const formatTodayDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hrs > 0) {
      return `${hrs}h ${mins}m`
    }
    return `${mins}m`
  }

  const isPollingRef = useRef(false)
  const activeControllerRef = useRef<AbortController | null>(null)

  const pollDashboardData = async () => {
    if (isPollingRef.current) return
    isPollingRef.current = true
    
    if (activeControllerRef.current) {
      activeControllerRef.current.abort()
    }
    const controller = new AbortController()
    activeControllerRef.current = controller
    
    try {
      const data = await getDashboardData(currentUser.id, currentUser.role || "team_lead", { signal: controller.signal })
      
      if (data.users) {
        setUsers(data.users)
      }
      if (data.recent_activity) {
        setRecentActivity(data.recent_activity)
      }
      if (data.productivity_trend) {
        setProductivityTrend(data.productivity_trend)
      }
      if (data.assigned_projects) {
        setAssignedProjects(data.assigned_projects)
      }
      if (data.summary) {
        setMe(data.summary)
      }
      if (data.monitoring_status) {
        updateOwnStatus(data.monitoring_status)
      }
      if (data.all_monitoring_statuses) {
        setAllMonitoringStatuses(data.all_monitoring_statuses)
      }
      if (data.personal_productivity_trend) {
        setPersonalProductivityTrend(data.personal_productivity_trend)
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Error polling dashboard data:", err)
      }
    } finally {
      isPollingRef.current = false
    }
  }

  // Fast polling for monitoring statuses
  useEffect(() => {
    const statusPoll = setInterval(() => {
      getAllMonitoringStatus()
        .then(data => {
          setAllMonitoringStatuses(data)
          const myStatus = data.find((s: any) => s.user_id === currentUser.id)
          if (myStatus) updateOwnStatus(myStatus)
        })
        .catch(err => {})
    }, 15000)
    return () => clearInterval(statusPoll)
  }, [currentUser.id])

  // Heavy polling for analytics
  const runPollRef = useRef<(() => Promise<void>) | null>(null)
  
  useEffect(() => {
    pollDashboardData()
    
    let active = true
    let timerId: any = null
    
    const runPoll = async () => {
      if (!active) return
      await pollDashboardData()
      if (active) {
        timerId = setTimeout(runPoll, 300000)
      }
    }
    
    runPollRef.current = runPoll
    timerId = setTimeout(runPoll, 300000)
    
    return () => {
      active = false
      if (timerId) clearTimeout(timerId)
      if (activeControllerRef.current) {
        activeControllerRef.current.abort()
      }
    }
  }, [])

  const handleManualRefresh = () => {
    if (runPollRef.current) {
      pollDashboardData()
      // Note: In a robust implementation we might clear the existing timeout here,
      // but triggering a manual poll is sufficient for immediate feedback.
    }
  }

  // Lead's own session duration ticker
  useEffect(() => {
    if (monitoringState !== "RUNNING") return
    const ticker = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(ticker)
  }, [monitoringState])

  // Team member sessions duration ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setAllMonitoringStatuses(prev =>
        prev.map(s =>
          s.current_state === "RUNNING"
            ? { ...s, elapsed_seconds: (s.elapsed_seconds || 0) + 1 }
            : s
        )
      )
    }, 1000)
    return () => clearInterval(ticker)
  }, [])

  const handleCommand = async (command: "START" | "PAUSE" | "RESUME" | "STOP") => {
    setActionLoading(true)
    if (command === "START") setMonitoringState("STARTING")
    if (command === "PAUSE") setMonitoringState("PAUSING")
    if (command === "RESUME") setMonitoringState("RESUMING")
    if (command === "STOP") setMonitoringState("STOPPING")

    try {
      const res = await sendMonitoringCommand(currentUser.id, command)
      if (res.success) {
        pollDashboardData()
      } else {
        alert(res.message || "Failed to execute command")
        pollDashboardData()
      }
    } catch (e) {
      alert("Error sending command to agent")
      pollDashboardData()
    } finally {
      setActionLoading(false)
    }
  }

  // Derive unique team member user IDs assigned in projects led by the current Lead
  const assignedTeamMemberIds = Array.from(
    new Set(assignedProjects.flatMap((p) => p.members?.map((m: any) => m.id) || []))
  )

  // Filter interns assigned to this Lead
  const teamMembers = users.filter((u) => assignedTeamMemberIds.includes(u.id))
  
  // Filter team members status
  const teamMonitoringStatuses = allMonitoringStatuses.filter(s => assignedTeamMemberIds.includes(s.user_id))

  const activeCount = me?.team_stats ? me.team_stats.active_members : teamMonitoringStatuses.filter((s) => s.current_state === "RUNNING").length
  const avgProd = me?.team_stats
    ? me.team_stats.team_productivity
    : (teamMembers.length === 0 ? 0 : Math.round(teamMembers.reduce((a, i) => a + (i.productivity || 0), 0) / teamMembers.length))
  const totalHours = me?.team_stats
    ? ((me.team_stats.team_active_mins + me.team_stats.team_idle_mins) / 60).toFixed(0)
    : teamMembers.reduce((a, i) => a + (i.workHours || 0), 0).toFixed(0)

  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Team Lead Dashboard" 
          description="Monitor team performance and manage your own tasks."
        />
        <Button variant="outline" onClick={handleManualRefresh} disabled={isPollingRef.current}>
          <Circle className={`mr-2 h-4 w-4 ${isPollingRef.current ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      {/* Persistent Monitoring Controls for the Lead (Monitored User) */}
      <Card className="overflow-hidden border-border/85 shadow-md">
        <CardContent className="flex flex-col gap-6 py-6 md:flex-row md:items-center md:justify-between bg-card/60">
          <div className="flex items-center gap-5">
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-all shadow-sm ${
                monitoringState === "RUNNING"
                  ? "bg-success/20 text-success animate-pulse"
                  : monitoringState === "PAUSED"
                  ? "bg-warning/20 text-warning"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {monitoringState === "RUNNING" ? (
                <Zap className="h-7 w-7" />
              ) : monitoringState === "PAUSED" ? (
                <Pause className="h-7 w-7" />
              ) : (
                <Square className="h-7 w-7" />
              )}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Your Monitoring State
                </p>
                <Badge
                  variant={
                    monitoringState === "RUNNING"
                      ? "success"
                      : monitoringState === "PAUSED"
                      ? "warning"
                      : ["STARTING", "PAUSING", "RESUMING", "STOPPING"].includes(monitoringState)
                      ? "warning"
                      : "neutral"
                  }
                  className="text-[10px] font-bold py-0.5 px-2.5"
                >
                  {monitoringState === "RUNNING"
                    ? "Running"
                    : monitoringState === "PAUSED"
                    ? "Paused"
                    : monitoringState === "IDLE"
                    ? "Idle"
                    : monitoringState === "STARTING"
                    ? "Starting..."
                    : monitoringState === "PAUSING"
                    ? "Pausing..."
                    : monitoringState === "RESUMING"
                    ? "Resuming..."
                    : monitoringState === "STOPPING"
                    ? "Stopping..."
                    : "Stopped"}
                </Badge>
                
                <span className="flex items-center gap-1.5 ml-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${agentOnline ? "bg-success animate-ping" : "bg-danger"}`} />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    {agentOnline ? "Agent Online" : "Agent Offline"}
                  </span>
                </span>
              </div>
              <p className="font-mono text-3xl font-black tracking-tight tabular-nums text-foreground mt-1">
                {formatDuration(elapsedSeconds)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {sessionStartTime && (
              <div className="hidden text-right pr-4 border-r border-border sm:block">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Session Started</p>
                <p className="text-xs font-bold text-foreground mt-0.5">
                  {new Date(sessionStartTime).toLocaleTimeString()}
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              {["STARTING", "PAUSING", "RESUMING", "STOPPING"].includes(monitoringState) && (
                <Button
                  variant="secondary"
                  disabled={true}
                  className="inline-flex items-center gap-2 px-5 font-bold shadow-sm h-10 animate-pulse"
                >
                  <span className="h-2 w-2 rounded-full bg-warning animate-ping" />
                  Please wait...
                </Button>
              )}

              {(monitoringState === "STOPPED" || monitoringState === "IDLE") && (
                <Button
                  variant="primary"
                  onClick={() => handleCommand("START")}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 font-bold h-10"
                >
                  <Play className="h-4 w-4 fill-current" /> Start Tracking
                </Button>
              )}

              {monitoringState === "RUNNING" && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => handleCommand("PAUSE")}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 h-10 font-bold"
                  >
                    <Pause className="h-4 w-4 fill-current" /> Pause
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleCommand("STOP")}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 h-10 font-bold"
                  >
                    <Square className="h-4 w-4 fill-current" /> Stop
                  </Button>
                </>
              )}

              {monitoringState === "PAUSED" && (
                <>
                  <Button
                    variant="primary"
                    onClick={() => handleCommand("RESUME")}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 h-10 font-bold"
                  >
                    <Play className="h-4 w-4 fill-current" /> Resume
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleCommand("STOP")}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 h-10 font-bold"
                  >
                    <Square className="h-4 w-4 fill-current" /> Stop
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Switcher */}
      <div className="flex border-b border-border gap-2">
        <Button
          variant={activeTab === "team" ? "primary" : "secondary"}
          onClick={() => setActiveTab("team")}
          className="h-9 font-bold px-4"
        >
          Team Analytics
        </Button>
        <Button
          variant={activeTab === "personal" ? "primary" : "secondary"}
          onClick={() => setActiveTab("personal")}
          className="h-9 font-bold px-4"
        >
          My Personal Dashboard
        </Button>
      </div>

      {activeTab === "team" ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Team Members" value={String(teamMembers.length)} icon={Users} />
            <StatCard label="Active Monitoring" value={String(activeCount)} icon={Activity} />
            <StatCard label="Avg Productivity" value={`${avgProd}%`} icon={Gauge} />
            <StatCard label="Uptime Tracked" value={`${totalHours}h`} icon={Clock} />
          </div>

          {me?.team_stats && (
            <Card>
              <CardHeader>
                <CardTitle>Team Today Used</CardTitle>
                <CardDescription>Real-time application and website usage breakdown for your team members today.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Applications</h3>
                  <div className="space-y-2">
                    {me.team_stats.team_today_apps?.slice(0, 6).map((app: any) => (
                      <div key={app.name} className="flex justify-between items-center text-sm py-1.5 border-b border-border/40 last:border-0">
                        <span className="font-semibold text-foreground truncate max-w-[200px]">{app.name}</span>
                        <span className="text-muted-foreground font-mono font-bold bg-secondary/40 px-2 py-0.5 rounded">{formatTodayDuration(app.duration)}</span>
                      </div>
                    ))}
                    {(!me.team_stats.team_today_apps || me.team_stats.team_today_apps.length === 0) && (
                      <p className="text-xs text-muted-foreground italic py-4">No team application usage recorded today.</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Websites</h3>
                  <div className="space-y-2">
                    {me.team_stats.team_today_sites?.slice(0, 6).map((site: any) => (
                      <div key={site.domain} className="flex justify-between items-center text-sm py-1.5 border-b border-border/40 last:border-0">
                        <span className="font-semibold text-foreground truncate max-w-[200px]">{site.domain}</span>
                        <span className="text-muted-foreground font-mono font-bold bg-secondary/40 px-2 py-0.5 rounded">{formatTodayDuration(site.duration)}</span>
                      </div>
                    ))}
                    {(!me.team_stats.team_today_sites || me.team_stats.team_today_sites.length === 0) && (
                      <p className="text-xs text-muted-foreground italic py-4">No team website visits recorded today.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Trend chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Team Productivity Trend</CardTitle>
                <CardDescription>Average score across your team members this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={productivityTrend} margin={{ left: -20, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="tlProd" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 13 }} />
                      <Area type="monotone" dataKey="productivity" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#tlProd)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Live members monitoring states & connection details */}
            <Card>
              <CardHeader>
                <CardTitle>Live Team Monitoring</CardTitle>
                <CardDescription>Real-time connection status of your team members.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 max-h-[300px] overflow-y-auto">
                {teamMonitoringStatuses.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={m.name} size={32} />
                      <div className="leading-tight min-w-0">
                        <p className="text-sm font-semibold truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          {m.current_session_id ? `Sess: ${m.current_session_id.slice(0, 8)}` : "No Active Session"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${m.agent_online ? "bg-success" : "bg-danger"}`} />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{m.agent_online ? "Online" : "Offline"}</span>
                      </span>
                      <Badge
                        variant={
                          m.current_state === "RUNNING"
                            ? "success"
                            : m.current_state === "PAUSED"
                            ? "warning"
                            : "neutral"
                        }
                        className="text-[9px] font-extrabold"
                      >
                        {m.current_state || "STOPPED"}
                      </Badge>
                      {m.elapsed_seconds > 0 && (
                        <span className="text-xs font-mono font-bold tabular-nums bg-secondary/35 px-1.5 py-0.5 rounded text-foreground">
                          {formatDuration(m.elapsed_seconds)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {teamMonitoringStatuses.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-10">No team members assigned.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <>
          {me && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Productivity" value={`${me.productivityToday !== undefined ? me.productivityToday : (me.productivity || 0)}%`} icon={Zap} />
                <StatCard label="Work hours today" value={fmt(me.today_work_mins !== undefined ? me.today_work_mins : (me.total_work_mins || 0))} icon={Clock} />
                <StatCard label="Break time" value={fmt(me.today_idle_mins !== undefined ? me.today_idle_mins : (me.total_idle_mins || 0))} icon={Coffee} />
                <StatCard label="Tasks done" value={`${me.completedTasksCount || 0}`} icon={Target} />
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Today Used</CardTitle>
                    <CardDescription>Real-time application and website usage breakdown for today.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Applications</h3>
                      <div className="space-y-2">
                        {me.today_apps?.slice(0, 6).map((app: any) => (
                          <div key={app.name} className="flex justify-between items-center text-sm py-1.5 border-b border-border/40 last:border-0">
                            <span className="font-semibold text-foreground truncate max-w-[200px]">{app.name}</span>
                            <span className="text-muted-foreground font-mono font-bold bg-secondary/40 px-2 py-0.5 rounded">{formatTodayDuration(app.duration)}</span>
                          </div>
                        ))}
                        {(!me.today_apps || me.today_apps.length === 0) && (
                          <p className="text-xs text-muted-foreground italic py-4">No application usage recorded today.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Websites</h3>
                      <div className="space-y-2">
                        {me.today_sites?.slice(0, 6).map((site: any) => (
                          <div key={site.domain} className="flex justify-between items-center text-sm py-1.5 border-b border-border/40 last:border-0">
                            <span className="font-semibold text-foreground truncate max-w-[200px]">{site.domain}</span>
                            <span className="text-muted-foreground font-mono font-bold bg-secondary/40 px-2 py-0.5 rounded">{formatTodayDuration(site.duration)}</span>
                          </div>
                        ))}
                        {(!me.today_sites || me.today_sites.length === 0) && (
                          <p className="text-xs text-muted-foreground italic py-4">No website visits recorded today.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="flex flex-col items-center justify-center">
                  <CardHeader>
                    <CardTitle>Today&apos;s score</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-3 pb-8 w-full max-w-[280px]">
                    <ProductivityRing value={me.productivityToday !== undefined ? me.productivityToday : (me.productivity || 0)} size={150} />
                    <p className="text-center text-sm text-muted-foreground text-pretty">
                      Your personal productivity rating based on active work time.
                    </p>
                    <div className="w-full mt-4 border-t border-border pt-4 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Productive Time:</span>
                        <span className="font-semibold text-foreground">{me.today_productive_mins || 0}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Neutral Time:</span>
                        <span className="font-semibold text-foreground">{me.today_neutral_mins || 0}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Unproductive Time:</span>
                        <span className="font-semibold text-foreground text-destructive">{me.today_unproductive_mins || 0}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Idle Time:</span>
                        <span className="font-semibold text-foreground">{me.today_idle_mins || 0}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Locked Time:</span>
                        <span className="font-semibold text-foreground">{me.today_locked_mins || 0}m</span>
                      </div>
                      <div className="flex justify-between border-t border-border/40 pt-2">
                        <span className="text-muted-foreground">Efficiency Ratio:</span>
                        <span className="font-semibold text-foreground">{me.today_efficiency || 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Activity Ratio:</span>
                        <span className="font-semibold text-foreground">{me.today_activity_ratio || 0}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Trend chart */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Productivity Trend</CardTitle>
                    <CardDescription>Your personal productivity score this week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={personalProductivityTrend} margin={{ left: -20, right: 8, top: 8 }}>
                          <defs>
                            <linearGradient id="personalProd" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                          <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 13 }} />
                          <Area type="monotone" dataKey="productivity" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#personalProd)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle>Your Activity Timeline</CardTitle>
                    <CardDescription>Recent meaningful events related to your account</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                    {recentActivity.filter(e => e.internId === currentUser.id).slice(0, 6).map((row) => {
                      const typeColors: Record<string, string> = {
                        monitoring: "oklch(0.65 0.18 200)",
                        task: "oklch(0.6 0.16 120)",
                        evidence: "oklch(0.7 0.15 70)",
                        project: "oklch(0.55 0.22 295)",
                      }
                      const dotColor = typeColors[row.type] || "oklch(0.6 0.18 12)"
                      return (
                        <div key={row.id} className="flex items-center gap-4 rounded-lg px-3 py-2.5 hover:bg-muted/60">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: dotColor }} />
                          <span className="flex-1 text-sm font-medium text-foreground">{row.action}</span>
                          {row.detail && <span className="hidden flex-1 text-sm text-muted-foreground sm:block truncate">{row.detail}</span>}
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {row.time ? new Date(row.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                          </span>
                        </div>
                      )
                    })}
                    {recentActivity.filter(e => e.internId === currentUser.id).length === 0 && (
                      <p className="text-sm text-muted-foreground italic py-4 text-center">No recent activity recorded.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Session History */}
              <Card>
                <CardHeader>
                  <CardTitle>Session History</CardTitle>
                  <CardDescription>Your tracked sessions and durations</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[300px] overflow-y-auto">
                  <div className="space-y-3">
                    {me.sessions?.map((sess: any) => {
                      const start = new Date(sess.start_time)
                      const dateStr = start.toLocaleDateString()
                      const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      const dur = sess.end_time 
                        ? fmt(sess.active_minutes + sess.idle_minutes)
                        : "Active Now"
                      const isActive = sess.status?.toUpperCase() === "ACTIVE" || sess.status?.toUpperCase() === "RUNNING"
                      return (
                        <div key={sess.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                          <div className="flex items-center gap-3">
                            <span className="text-sm shrink-0">{isActive ? "🟢" : "⚫"}</span>
                            <div>
                              <p className="text-sm font-semibold">{dateStr} at {timeStr}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">ID: {sess.id}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs font-semibold text-foreground">{dur}</p>
                              <p className="text-[10px] text-muted-foreground">Active: {fmt(sess.active_minutes)}</p>
                            </div>
                            <Badge variant={isActive ? "success" : "neutral"} className="text-[9px] font-bold">
                              {sess.status}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                    {(!me.sessions || me.sessions.length === 0) && (
                      <p className="text-xs text-muted-foreground italic text-center py-10">No sessions recorded.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Screenshots */}
              {(() => {
                const groupedShots: { [key: string]: any[] } = {}
                me.screenshots?.forEach((shot: any) => {
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
                    activity: shot.activity,
                    cloudinary_url: shot.cloudinary_url
                  })
                })
                const screenshotHours = Object.keys(groupedShots).map(hour => ({
                  hour,
                  shots: groupedShots[hour]
                }))

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Captured Screenshots ({me.screenshot_count || 0})</CardTitle>
                      <CardDescription>Visual timeline of your desktop work activity</CardDescription>
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
                                      src={shot.cloudinary_url || `${BASE_URL}/${shot.file_path}`}
                                      alt={shot.app}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <MockScreenshot app={shot.app} />
                                  )}
                                </div>
                                <div className="flex items-center justify-between px-0.5">
                                  <span className="font-mono text-xs text-muted-foreground">{shot.time}</span>
                                  <Badge variant={shot.activity > 60 ? "success" : "warning"}>{shot.activity}%</Badge>
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
                )
              })()}
            </>
          )}
        </>
      )}
    </div>
  )
}
