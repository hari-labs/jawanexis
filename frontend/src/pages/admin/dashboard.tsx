import { BASE_URL } from "@/services/api";
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts"
import { Users, Activity, Gauge, Clock, ArrowUpRight, Coffee, ShieldAlert, FolderKanban, ClipboardCheck, ListTodo, FileText, Download, Circle } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    getCounts,
    getUsersList,
    getRecentActivity,
    getAppUsage,
    getSiteUsage,
    categoryColor,
    getProductivityTrend,
    getAllMonitoringStatus
} from "@/services/api"

export function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([])
  const [counts, setCounts] = useState({
    intern_count: 0,
    team_lead_count: 0,
    project_count: 0,
    pending_task_count: 0,
    pending_evidence_count: 0
  })
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [appUsage, setAppUsage] = useState<any[]>([])
  const [siteUsage, setSiteUsage] = useState<any[]>([])
  const [productivityTrend, setProductivityTrend] = useState<any[]>([])
  const [monitoringStatuses, setMonitoringStatuses] = useState<any[]>([])

  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadData = async () => {
    setIsRefreshing(true)
    try {
      setCounts(await getCounts())
      setUsers(await getUsersList())
      setRecentActivity(await getRecentActivity())
      setAppUsage(await getAppUsage())
      setSiteUsage(await getSiteUsage())
      setProductivityTrend(await getProductivityTrend())
      setMonitoringStatuses(await getAllMonitoringStatus())
    } catch (err) {
      console.error(err)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    
    // Poll monitoring status every 15 seconds
    const statusPoll = setInterval(() => {
      getAllMonitoringStatus()
        .then(data => setMonitoringStatuses(data))
        .catch(err => {})
    }, 15000)

    return () => clearInterval(statusPoll)
  }, [])

  // Local duration ticking for active monitoring states
  useEffect(() => {
    const ticker = setInterval(() => {
      setMonitoringStatuses(prev =>
        prev.map(s =>
          s.current_state === "RUNNING"
            ? { ...s, elapsed_seconds: (s.elapsed_seconds || 0) + 1 }
            : s
        )
      )
    }, 1000)
    return () => clearInterval(ticker)
  }, [])

  const internsCount = counts.intern_count || 0
  const teamLeadsCount = counts.team_lead_count || 0
  
  const onlineCount = monitoringStatuses.filter(s => s.agent_online).length
  const offlineCount = monitoringStatuses.filter(s => !s.agent_online).length
  const runningCount = monitoringStatuses.filter(s => s.current_state === "RUNNING").length
  const pausedCount = monitoringStatuses.filter(s => s.current_state === "PAUSED").length

  const topApps =
      [...appUsage]
          .sort((a, b) => b.minutes - a.minutes)
          .slice(0, 5)

  const topSites =
      [...siteUsage]
          .sort((a, b) => b.minutes - a.minutes)
          .slice(0, 5)

  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Dashboard" description="Real-time overview of your intern program's productivity." />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData} disabled={isRefreshing}>
            <Circle className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
          <Link to="/admin/invitations">
            <Button>
              Invite User
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Persistent Monitoring Counters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Projects" value={String(counts.project_count || 0)} icon={FolderKanban} />
        <StatCard label="Total Team Leads" value={String(teamLeadsCount)} icon={Users} />
        <StatCard label="Total Interns" value={String(internsCount)} icon={Users} />
        <StatCard label="Online Users" value={String(onlineCount)} icon={Activity} />
        <StatCard label="Offline Users" value={String(offlineCount)} icon={ShieldAlert} />
        <StatCard label="Running Sessions" value={String(runningCount)} icon={Gauge} />
        <StatCard label="Paused Sessions" value={String(pausedCount)} icon={Coffee} />
        <StatCard label="Pending Reviews" value={String(counts.pending_evidence_count || 0)} icon={ClipboardCheck} />
        <StatCard label="Pending Tasks" value={String(counts.pending_task_count || 0)} icon={ListTodo} />
      </div>

      {/* Live Monitoring Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle>Live Monitoring Console</CardTitle>
          <CardDescription>Real-time agent connection statuses and active tracking sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border pb-2 text-xs font-semibold text-muted-foreground uppercase">
                  <th className="py-2.5">User</th>
                  <th className="py-2.5">Role</th>
                  <th className="py-2.5">Agent State</th>
                  <th className="py-2.5">Connection</th>
                  <th className="py-2.5">Session ID</th>
                  <th className="py-2.5">Current Duration</th>
                  <th className="py-2.5">Last Heartbeat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {monitoringStatuses.map((state) => (
                  <tr key={state.user_id} className="hover:bg-secondary/15 transition-colors">
                    <td className="py-3 font-semibold text-foreground">{state.name} <span className="text-xs text-muted-foreground font-medium">({state.email})</span></td>
                    <td className="py-3 capitalize text-muted-foreground">{state.role.replace("_", " ")}</td>
                    <td className="py-3">
                      <Badge
                        variant={
                          state.current_state === "RUNNING"
                            ? "success"
                            : state.current_state === "PAUSED"
                            ? "warning"
                            : "neutral"
                        }
                        className="text-[10px] font-bold"
                      >
                        {state.current_state}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1.5 font-bold text-xs">
                        <span className={`h-2 w-2 rounded-full ${state.agent_online ? "bg-success" : "bg-danger"}`} />
                        {state.agent_online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">
                      {state.current_session_id ? state.current_session_id.slice(0, 10) + "..." : "None"}
                    </td>
                    <td className="py-3 font-mono text-xs font-bold text-foreground">
                      {state.elapsed_seconds ? formatDuration(state.elapsed_seconds) : "-"}
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {state.last_seen ? new Date(state.last_seen).toLocaleTimeString() : "Never"}
                    </td>
                  </tr>
                ))}
                {monitoringStatuses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-muted-foreground italic">No active connections recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Trend chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Productivity trend</CardTitle>
              <CardDescription>Average score across all interns this week</CardDescription>
            </div>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              7 days
            </span>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={productivityTrend} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="prod" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      fontSize: 13,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Area type="monotone" dataKey="productivity" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#prod)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest meaningful events across the team</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {recentActivity.slice(0, 8).map((e) => {
                const intern = users.find((i) => i.id === e.internId)
                const typeColors: Record<string, string> = {
                  monitoring: "oklch(0.65 0.18 200)",
                  task: "oklch(0.6 0.16 120)",
                  evidence: "oklch(0.7 0.15 70)",
                  project: "oklch(0.55 0.22 295)",
                }
                const dotColor = typeColors[e.type] || "oklch(0.6 0.18 12)"
                return (
                  <li key={e.id} className="flex items-start gap-3">
                    <Avatar name={e.intern} color={intern?.avatarColor} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-semibold">{e.intern}</span>{" "}
                        <span className="text-muted-foreground text-xs">{e.action}</span>
                      </p>
                      {e.detail && (
                        <p className="truncate text-[11px] text-muted-foreground mt-0.5">{e.detail}</p>
                      )}
                    </div>
                    <span className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ background: dotColor }} />
                  </li>
                )
              })}
              {recentActivity.length === 0 && (
                <p className="text-muted-foreground italic text-center py-6 text-sm">No recent activity recorded.</p>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Recent Deliverables (Evidence) - Temporarily hidden as data is no longer loaded on start */}
        <Card className="lg:col-span-1 hidden">
          <CardHeader>
            <CardTitle>Recent deliverables</CardTitle>
            <CardDescription>Latest task evidence uploads</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[260px] overflow-y-auto pr-1">
          </CardContent>
        </Card>
      </div>

      {/* Usage overviews */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UsageCard title="Application usage" description="Top apps by time spent today" data={topApps.map((a) => ({ name: a.name, minutes: a.minutes, category: a.category }))} />
        <UsageCard title="Website usage" description="Top domains by time spent today" data={topSites.map((s) => ({ name: s.domain, minutes: s.minutes, category: s.category }))} />
      </div>
    </div>
  )
}

function UsageCard({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: { name: string; minutes: number; category: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 60)}h`} />
              <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={92} />
              <Tooltip
                cursor={{ fill: "var(--color-secondary)" }}
                formatter={(v) => [`${Math.round(Number(v ?? 0) / 60)}h ${Number(v ?? 0) % 60}m`, "Time"]}
                contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 13 }}
              />
              <Bar dataKey="minutes" radius={[0, 6, 6, 0]} barSize={18}>
                {data.map((d, i) => (
                  <Cell key={i} fill={categoryColor(d.category)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Legend color={categoryColor("productive")} label="Productive" />
          <Legend color={categoryColor("neutral")} label="Neutral" />
          <Legend color={categoryColor("distracting")} label="Distracting" />
        </div>
      </CardContent>
    </Card>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}