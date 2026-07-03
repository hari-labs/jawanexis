import { useState, useEffect, useRef } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { ProductivityRing } from "@/components/productivity-ring"
import {
  getProductivityTrend,
  getRecentActivity,
  getInternSummary,
  getMonitoringStatus,
  sendMonitoringCommand,
  getDashboardData
} from "@/services/api"
import { Clock, Coffee, Zap, Play, Pause, Square, Target, Circle } from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

function fmt(min: number) {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function InternDashboard() {
  const [me, setMe] = useState<any>(null)
  const [userId, setUserId] = useState<string>("")
  const [productivityTrend, setProductivityTrend] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  
  // Monitoring status states
  const [monitoringState, setMonitoringState] = useState<"RUNNING" | "PAUSED" | "STOPPED" | "IDLE" | "STARTING" | "PAUSING" | "RESUMING" | "STOPPING">("STOPPED")
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [agentOnline, setAgentOnline] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [agentOfflineWarning, setAgentOfflineWarning] = useState(false)

  const isPollingRef = useRef(false)
  const activeControllerRef = useRef<AbortController | null>(null)

  const pollDashboardData = async (uid: string) => {
    if (isPollingRef.current) return
    isPollingRef.current = true
    
    if (activeControllerRef.current) {
      activeControllerRef.current.abort()
    }
    const controller = new AbortController()
    activeControllerRef.current = controller
    
    try {
      const data = await getDashboardData(uid, "intern", { signal: controller.signal })
      
      if (data.summary) {
        setMe(data.summary)
      }
      
      if (data.monitoring_status) {
        const status = data.monitoring_status
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
      
      if (data.productivity_trend) {
        setProductivityTrend(data.productivity_trend)
      }
      
      if (data.recent_activity) {
        setRecentActivity(data.recent_activity)
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Error polling dashboard data:", err)
      }
    } finally {
      isPollingRef.current = false
    }
  }

  useEffect(() => {
    const storedUserStr = localStorage.getItem("user")
    if (storedUserStr) {
      try {
        const parsedUser = JSON.parse(storedUserStr)
        const uid = parsedUser.id || ""
        setUserId(uid)
        
        pollDashboardData(uid)
        
        let active = true
        let timerId: any = null
        
        const runPoll = async () => {
          if (!active) return
          await pollDashboardData(uid)
          if (active) {
            timerId = setTimeout(runPoll, 60000)
          }
        }
        
        timerId = setTimeout(runPoll, 60000)
        
        return () => {
          active = false
          if (timerId) clearTimeout(timerId)
          if (activeControllerRef.current) {
            activeControllerRef.current.abort()
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
  }, [])

  // Local ticker for elapsed time
  useEffect(() => {
    if (monitoringState !== "RUNNING") return
    
    const ticker = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    
    return () => clearInterval(ticker)
  }, [monitoringState])

  const handleCommand = async (command: "START" | "PAUSE" | "RESUME" | "STOP") => {
    if (!userId) return
    setActionLoading(true)
    setAgentOfflineWarning(false)
    // Optimistically show transition state
    if (command === "START") setMonitoringState("STARTING")
    if (command === "PAUSE") setMonitoringState("PAUSING")
    if (command === "RESUME") setMonitoringState("RESUMING")
    if (command === "STOP") setMonitoringState("STOPPING")

    try {
      const res = await sendMonitoringCommand(userId, command)
      if (res.success) {
        // If agent is offline, show a warning that command is queued
        if (command === "START" && !agentOnline) {
          setAgentOfflineWarning(true)
        }
        pollDashboardData(userId)
      } else {
        alert(res.message || "Failed to issue command")
        pollDashboardData(userId)
      }
    } catch (e) {
      alert("Error sending command to backend")
      pollDashboardData(userId)
    } finally {
      setActionLoading(false)
    }
  }

  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const formatTodayDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hrs > 0) {
      return `${hrs}h ${mins}m`
    }
    return `${mins}m`
  }

  if (!me) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-lg font-semibold">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${me.name.split(" ")[0]}`}
        description="Here is your activity summary for today."
      />

      {/* Persistent Monitoring Controls */}
      <Card className="overflow-hidden border-border/80 shadow-md">
        {agentOfflineWarning && (
          <div className="bg-warning/10 border-b border-warning/30 px-6 py-3 flex items-center gap-3">
            <Circle className="h-4 w-4 text-warning flex-shrink-0" />
            <p className="text-sm font-medium text-warning">
              <span className="font-bold">Desktop Agent is offline.</span> The START command has been queued.
              Launch the Desktop Agent app — it will automatically begin monitoring when it connects.
            </p>
          </div>
        )}
        <CardContent className="flex flex-col gap-6 py-6 md:flex-row md:items-center md:justify-between bg-card">
          <div className="flex items-center gap-5">
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-all shadow-sm ${
                monitoringState === "RUNNING"
                  ? "bg-success/20 text-success animate-pulse"
                  : monitoringState === "PAUSED"
                  ? "bg-warning/20 text-warning"
                  : ["STARTING", "PAUSING", "RESUMING", "STOPPING"].includes(monitoringState)
                  ? "bg-primary/20 text-primary animate-pulse"
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
                  Monitoring State
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
                    ? (agentOnline ? "Starting..." : "Queued — Waiting for Agent")
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

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-left md:text-right pr-4 border-r border-border hidden sm:block">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Session Start</p>
              <p className="text-xs font-bold text-foreground mt-0.5">
                {sessionStartTime ? new Date(sessionStartTime).toLocaleTimeString() : "No active session"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {["STARTING", "PAUSING", "RESUMING", "STOPPING"].includes(monitoringState) && (
                <Button
                  variant="secondary"
                  disabled={true}
                  className="inline-flex items-center gap-2 px-5 font-bold shadow-sm h-10 animate-pulse"
                >
                  <span className="h-2 w-2 rounded-full bg-warning animate-ping" />
                  {monitoringState === "STARTING" && !agentOnline ? "Waiting for Agent..." : "Please wait..."}
                </Button>
              )}

              {(monitoringState === "STOPPED" || monitoringState === "IDLE") && (
                <Button
                  variant="primary"
                  onClick={() => handleCommand("START")}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-5 font-bold shadow-sm h-10"
                >
                  <Play className="h-4 w-4 fill-current" /> Start Monitoring
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
        {lastSeen && (
          <div className="bg-secondary/20 px-6 py-2.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-medium">
            <span>Last Sync/Heartbeat: {new Date(lastSeen).toLocaleString()}</span>
            <span>Refreshes dynamically based on agent feedback</span>
          </div>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Productivity" value={`${me.productivityToday !== undefined ? me.productivityToday : (me.productivity || 0)}%`} icon={Zap} />
        <StatCard label="Work hours today" value={fmt(me.today_work_mins !== undefined ? me.today_work_mins : (me.total_work_mins || 0))} icon={Clock} />
        <StatCard label="Break time" value={fmt(me.today_idle_mins !== undefined ? me.today_idle_mins : (me.total_idle_mins || 0))} icon={Coffee} />
        <StatCard label="Tasks done" value={`${me.completedTasksCount || 0}`} icon={Target} />
      </div>

      <Card>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Productivity this week</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={productivityTrend} margin={{ left: -20, right: 8 }}>
                <defs>
                  <linearGradient id="internArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="productivity"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  fill="url(#internArea)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="flex flex-col items-center justify-center">
          <CardHeader>
            <CardTitle>Today&apos;s score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 pb-8 w-full max-w-[280px]">
            <ProductivityRing value={me.productivityToday !== undefined ? me.productivityToday : (me.productivity || 0)} size={150} />
            <p className="text-center text-sm text-muted-foreground text-pretty">
              {(me.productivityToday !== undefined ? me.productivityToday : (me.productivity || 0)) >= 80
                ? "Excellent focus! You're performing highly productively today."
                : (me.productivityToday !== undefined ? me.productivityToday : (me.productivity || 0)) >= 50
                ? "Good progress. Keep staying focused on productive tasks."
                : "Stay focused. Try to minimize usage of distracting sites."}
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

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s activity timeline</CardTitle>
          <CardDescription>Recent meaningful events for your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {recentActivity.filter(e => e.internId === userId).slice(0, 6).map((row) => {
            const typeColors: Record<string, string> = {
              monitoring: "oklch(0.65 0.18 200)",
              task: "oklch(0.6 0.16 120)",
              evidence: "oklch(0.7 0.15 70)",
              project: "oklch(0.55 0.22 295)",
            }
            const dotColor = typeColors[row.type] || "oklch(0.6 0.18 12)"
            return (
              <div
                key={row.id}
                className="flex items-center gap-4 rounded-lg px-3 py-2.5 hover:bg-muted/60"
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: dotColor }} />
                <span className="flex-1 text-sm font-medium text-foreground">{row.action}</span>
                {row.detail && <span className="hidden flex-1 text-sm text-muted-foreground sm:block truncate">{row.detail}</span>}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {row.time ? new Date(row.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                </span>
              </div>
            )
          })}
          {recentActivity.filter(e => e.internId === userId).length === 0 && (
            <p className="text-sm text-muted-foreground italic py-4 text-center">No recent events recorded for your account.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
