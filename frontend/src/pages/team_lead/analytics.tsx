import { useEffect, useState } from "react"
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts"
import { AppWindow, Globe, Gauge, Clock, ChevronDown, Camera, Calendar, X, Activity } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/stat-card"
import { getAppUsage, getSiteUsage, categoryColor, getProductivityTrend, getWorkTimeTrend, getUsersList, getAssignedProjects, getInternSummary, getScreenshots } from "@/services/api"
import { BASE_URL } from "@/services/api";

const tabs = [
  { id: "apps", label: "Application usage", icon: AppWindow },
  { id: "sites", label: "Website usage", icon: Globe },
  { id: "productivity", label: "Productivity", icon: Gauge },
  { id: "worktime", label: "Work time", icon: Clock },
  { id: "screenshots", label: "Screenshots", icon: Camera },
] as const

type Tab = (typeof tabs)[number]["id"]

const categoryTotals = (data: { category: string; minutes: number }[]) => {
  const totals: Record<string, number> = { productive: 0, neutral: 0, distracting: 0 }
  data.forEach((d) => (totals[d.category] += d.minutes))
  return Object.entries(totals).map(([category, minutes]) => ({ category, minutes }))
}

export function TeamAnalytics() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const isTeamLead = currentUser.role === "team_lead" || currentUser.role === "team lead"

  const [tab, setTab] = useState<Tab>("apps")
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    isTeamLead ? currentUser.id : "all"
  )
  
  const [appUsage, setAppUsage] = useState<any[]>([])
  const [siteUsage, setSiteUsage] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    if (isTeamLead) {
        Promise.all([getUsersList(), getAssignedProjects(currentUser.id)])
            .then(([allUsers, projects]) => {
                const assignedMemberIds = new Set(
                    projects.flatMap((p: any) => p.members?.map((m: any) => m.id) || [])
                )
                const filtered = allUsers.filter((u: any) => 
                    u.id === currentUser.id || (u.role.toLowerCase() === "intern" && assignedMemberIds.has(u.id))
                )
                setTeamMembers(filtered)
            })
            .catch(() => {})
    } else {
        getUsersList()
            .then((data) => {
                setTeamMembers(data.filter((u: any) => 
                    u.role.toLowerCase() === "intern" || u.role.toLowerCase() === "team_lead" || u.role.toLowerCase() === "team lead"
                ))
            })
            .catch(() => {})
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const memberId = selectedMemberId === "all" ? undefined : selectedMemberId
    
    getAppUsage(memberId, { signal: controller.signal })
      .then(data => setAppUsage(data))
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err)
      })
      
    getSiteUsage(memberId, { signal: controller.signal })
      .then(data => setSiteUsage(data))
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err)
      })

    const targetId = selectedMemberId === "all" ? currentUser.id : selectedMemberId
    getInternSummary(targetId, undefined, { signal: controller.signal })
      .then(data => setSummary(data))
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err)
      })
      
    return () => {
      controller.abort()
    }
  }, [selectedMemberId])

  const selectedMember = teamMembers.find((m) => m.id === selectedMemberId)

  const formatHoursMins = (minutes: number | undefined) => {
    const m = minutes || 0
    const hrs = Math.floor(m / 60)
    const mins = Math.round(m % 60)
    if (hrs > 0) {
      return `${hrs}h ${mins}m`
    }
    return `${mins}m`
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Team Analytics" description="Detailed productivity dashboards for your team members.">
        <div className="relative">
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium outline-none focus:border-ring w-48"
          >
            <option value="all">All Team Members</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === currentUser.id ? `${m.name} (Myself)` : m.name}
              </option>
            ))}
          </select>
        </div>
      </PageHeader>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={selectedMemberId === "all" ? "Team Productivity" : "Productivity Score"}
          value={`${selectedMemberId === "all" ? summary?.team_stats?.team_productivity ?? 0 : summary?.productivity ?? 0}%`}
          icon={Gauge}
        />
        <StatCard
          label={selectedMemberId === "all" ? "Team Active Time" : "Active Time"}
          value={formatHoursMins(selectedMemberId === "all" ? summary?.team_stats?.team_active_mins : summary?.total_active_mins)}
          icon={Clock}
        />
        <StatCard
          label={selectedMemberId === "all" ? "Team Break Time" : "Break Time"}
          value={formatHoursMins(selectedMemberId === "all" ? summary?.team_stats?.team_idle_mins : summary?.total_idle_mins)}
          icon={Activity}
        />
        <StatCard
          label={selectedMemberId === "all" ? "Team Screenshots" : "Screenshots"}
          value={String(selectedMemberId === "all" ? summary?.team_stats?.team_screenshot_count ?? 0 : summary?.screenshot_count ?? 0)}
          icon={Camera}
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-secondary/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors " +
              (tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
            }
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "apps" && <UsageReport title="Application usage" data={appUsage.map((a) => ({ name: a.name, minutes: a.minutes, category: a.category }))} />}
      {tab === "sites" && <UsageReport title="Website usage" data={siteUsage.map((s) => ({ name: s.domain, minutes: s.minutes, category: s.category }))} />}
      {tab === "productivity" && <ProductivityReport memberId={selectedMemberId === "all" ? undefined : selectedMemberId} />}
      {tab === "worktime" && <WorkTimeReport memberId={selectedMemberId === "all" ? undefined : selectedMemberId} />}
      {tab === "screenshots" && <ScreenshotsReport memberId={selectedMemberId === "all" ? undefined : selectedMemberId} teamMembers={teamMembers} />}
    </div>
  )
}

function UsageReport({ title, data }: { title: string; data: { name: string; minutes: number; category: string }[] }) {
  const sorted = [...data].sort((a, b) => b.minutes - a.minutes)
  const pie = categoryTotals(data)
  const totalMin = data.reduce((a, d) => a + d.minutes, 0)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{title} breakdown</CardTitle>
          <CardDescription>Time spent per item this week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 60)}h`} />
                <Tooltip cursor={{ fill: "var(--color-secondary)" }} formatter={(v) => [`${Math.round(Number(v ?? 0) / 60)}h ${Number(v ?? 0) % 60}m`, "Time"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 13 }} />
                <Bar dataKey="minutes" radius={[6, 6, 0, 0]} barSize={36}>
                  {sorted.map((d, i) => (
                    <Cell key={i} fill={categoryColor(d.category)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
          <CardDescription>Share of total time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="minutes" nameKey="category" innerRadius={48} outerRadius={72} paddingAngle={2}>
                  {pie.map((d, i) => (
                    <Cell key={i} fill={categoryColor(d.category)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${Math.round(Number(v ?? 0) / 60)}h`, ""]} contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {pie.map((d) => (
              <div key={d.category} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 capitalize">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: categoryColor(d.category) }} />
                  {d.category}
                </span>
                <span className="font-medium tabular-nums">{totalMin === 0 ? 0 : Math.round((d.minutes / totalMin) * 100)}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ProductivityReport({ memberId }: { memberId?: string }) {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    getProductivityTrend(7, memberId)
      .then(res => setData(res))
  }, [memberId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productivity analytics</CardTitle>
        <CardDescription>Team productivity score over the week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="rep-tl-prod" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 13 }} />
              <Area type="monotone" dataKey="productivity" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#rep-tl-prod)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function WorkTimeReport({ memberId }: { memberId?: string }) {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    getWorkTimeTrend(7, memberId)
      .then(res => setData(res))
  }, [memberId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Work time report</CardTitle>
        <CardDescription>Total tracked hours per day</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
              <Tooltip cursor={{ fill: "var(--color-secondary)" }} formatter={(v) => [`${Number(v ?? 0)}h`, "Hours"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 13 }} />
              <Bar dataKey="work_hours" radius={[6, 6, 0, 0]} barSize={40} fill="var(--color-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function ScreenshotsReport({ memberId, teamMembers }: { memberId?: string; teamMembers: any[] }) {
  const [screenshotHours, setScreenshotHours] = useState<any[]>([])
  const getLocalDateString = () => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const [date, setDate] = useState(getLocalDateString())
  const [preview, setPreview] = useState<any>(null)

  useEffect(() => {
    getScreenshots(memberId, date).then((data) => {
      const sorted = [...data].sort((a: any, b: any) => b.hour.localeCompare(a.hour))
      setScreenshotHours(sorted)
    }).catch(() => {})
  }, [memberId, date])

  const total = screenshotHours.reduce((a, h) => a + h.shots.length, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/20 p-4 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium outline-none focus:border-ring w-48"
          />
        </div>
        <Badge variant="primary" className="w-fit">
          <Camera className="h-3.5 w-3.5 mr-1" />
          {total} captures
        </Badge>
      </div>

      <div className="flex flex-col gap-6">
        {screenshotHours.map((group) => (
          <section key={group.hour}>
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{group.hour}</h2>
              <span className="text-xs text-muted-foreground">· {group.shots.length} captures</span>
              <div className="ml-2 h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {group.shots.map((shot: any) => {
                const member = teamMembers.find((m) => m.id === shot.user_id)
                return (
                  <button
                    key={shot.id}
                    onClick={() => setPreview({ ...shot, memberName: member?.name || "Team Member" })}
                    className="group overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-video">
                      <img
                        src={shot.cloudinary_url || `${BASE_URL}/${shot.file_path}`}
                        alt={shot.app}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {shot.time}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="flex flex-col text-[11px] font-medium truncate max-w-[120px]">
                        <span className="text-muted-foreground font-bold truncate">{member?.name || "Team Member"}</span>
                        <span className="truncate text-foreground font-semibold">{shot.app}</span>
                      </span>
                      <span
                        className="text-xs font-semibold tabular-nums"
                        style={{ color: shot.activity >= 70 ? "oklch(0.55 0.15 150)" : shot.activity >= 40 ? "oklch(0.6 0.13 65)" : "oklch(0.6 0.2 25)" }}
                      >
                        {shot.activity}%
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
        {screenshotHours.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">No screenshots captured for this date.</p>
        )}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex flex-col">
                <p className="text-sm font-semibold">{preview.memberName}</p>
                <p className="text-xs text-muted-foreground">
                  {preview.app} {preview.window_title ? `— ${preview.window_title}` : ""} · {preview.time}
                </p>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="aspect-video">
              <img
                  src={preview.cloudinary_url || `${BASE_URL}/${preview.file_path}`}
                  alt={preview.app}
                  className="h-full w-full object-cover"
              />
            </div>
            <div className="flex items-center gap-6 px-5 py-3 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-4 w-4" />
                Activity level
                <span className="font-semibold text-foreground">{preview.activity}%</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                Captured at <span className="font-semibold text-foreground">{preview.time}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}