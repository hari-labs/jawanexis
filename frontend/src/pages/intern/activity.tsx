import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { MockScreenshot } from "@/components/mock-screenshot"
import { useState, useEffect } from "react"
import { getInternSummary, categoryColor } from "@/services/api"
import { BASE_URL } from "@/services/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts"
import { Clock, Activity, Coffee, Gauge, Calendar, ShieldAlert } from "lucide-react"

function fmt(min: number) {
  const totalMins = Math.round(min)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h > 0) {
    return `${h}h ${m}m`
  }
  return `${m}m`
}

function UsageBar({ label, minutes, max, category }: { label: string; minutes: number; max: number; category: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground truncate max-w-[70%]">{label}</span>
        <span className="text-muted-foreground shrink-0">{fmt(minutes)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${(minutes / max) * 100}%`, background: categoryColor(category) }}
        />
      </div>
    </div>
  )
}

export function ActivityPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all")
  const [sessions, setSessions] = useState<any[]>([])
  const [summaryData, setSummaryData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUserStr = localStorage.getItem("user")
    if (storedUserStr) {
      try {
        const parsedUser = JSON.parse(storedUserStr)
        setLoading(true)
        const controller = new AbortController()
        
        getInternSummary(parsedUser.id, selectedSessionId, { signal: controller.signal })
          .then(data => {
            setSummaryData(data)
            if (data.sessions) {
              setSessions(data.sessions)
            }
            setLoading(false)
          })
          .catch((err) => {
            if (err.name !== "AbortError") {
              setLoading(false)
            }
          })
          
        return () => {
          controller.abort()
        }
      } catch (e) {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [selectedSessionId])

  if (loading && !summaryData) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-lg font-semibold">Loading activity details...</p>
      </div>
    )
  }

  // Fallbacks if data empty
  const apps = summaryData?.apps || []
  const sites = summaryData?.sites || []
  const screenshots = summaryData?.screenshots || []
  
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

  let scopeSuffix = "All Time"
  if (selectedSessionId === "today") {
    scopeSuffix = "Today"
  } else if (selectedSessionId === "week") {
    scopeSuffix = "Week"
  } else if (selectedSessionId !== "all") {
    scopeSuffix = "Selected Session"
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Dashboard" description="Review apps, web traffic, and captured desktop states." />

      {/* Session Filter */}
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
          {sessions.map((sess) => {
            const start = new Date(sess.start_time)
            const dateStr = start.toLocaleDateString()
            const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            const dur = sess.end_time 
              ? fmt(sess.active_minutes + sess.idle_minutes)
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

      {/* Metrics Row */}
      {summaryData && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">Tracked Time ({scopeSuffix})</p>
                <p className="text-lg font-bold mt-0.5">{fmt(summaryData.scope_tracked_mins !== undefined ? summaryData.scope_tracked_mins : summaryData.total_work_mins)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">Active Time ({scopeSuffix})</p>
                <p className="text-lg font-bold mt-0.5">{fmt(summaryData.scope_active_mins !== undefined ? summaryData.scope_active_mins : summaryData.total_active_mins)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <Coffee className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">Idle Time ({scopeSuffix})</p>
                <p className="text-lg font-bold mt-0.5">{fmt(summaryData.scope_idle_mins !== undefined ? summaryData.scope_idle_mins : summaryData.total_idle_mins)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Gauge className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">Productivity ({scopeSuffix})</p>
                <p className="text-lg font-bold mt-0.5 text-primary">{(summaryData.scope_productivity !== undefined ? summaryData.scope_productivity : summaryData.productivity)}%</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart & Performance Details Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Time by application</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    fontSize: 12,
                  }}
                  formatter={(v: any) => fmt(Number(v))}
                />
                <Bar dataKey="minutes" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {summaryData && (
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Performance details ({scopeSuffix})</CardTitle>
              <CardDescription>Scope breakdown telemetry metrics</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center text-xs space-y-2.5 pb-6">
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">Tracked Time:</span>
                <span className="font-semibold text-foreground font-mono">{summaryData.scope_tracked_mins || 0}m ({fmt(summaryData.scope_tracked_mins || 0)})</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">Active Time:</span>
                <span className="font-semibold text-foreground font-mono">{summaryData.scope_active_mins || 0}m ({fmt(summaryData.scope_active_mins || 0)})</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">Idle Time:</span>
                <span className="font-semibold text-foreground font-mono">{summaryData.scope_idle_mins || 0}m ({fmt(summaryData.scope_idle_mins || 0)})</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">Locked Time:</span>
                <span className="font-semibold text-foreground font-mono">{summaryData.scope_locked_mins || 0}m ({fmt(summaryData.scope_locked_mins || 0)})</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">Productive Time:</span>
                <span className="font-semibold text-foreground font-mono">{summaryData.scope_productive_mins || 0}m ({fmt(summaryData.scope_productive_mins || 0)})</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">Neutral Time:</span>
                <span className="font-semibold text-foreground font-mono">{summaryData.scope_neutral_mins || 0}m ({fmt(summaryData.scope_neutral_mins || 0)})</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">Unproductive Time:</span>
                <span className="font-semibold text-destructive font-mono">{summaryData.scope_unproductive_mins || 0}m ({fmt(summaryData.scope_unproductive_mins || 0)})</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">Efficiency Ratio:</span>
                <span className="font-semibold text-foreground font-mono">{summaryData.scope_efficiency || 0}%</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">Activity Ratio:</span>
                <span className="font-semibold text-foreground font-mono">{summaryData.scope_activity_ratio || 0}%</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground font-medium">Productivity Score:</span>
                <span className="font-bold text-primary font-mono">{summaryData.scope_productivity || 0}%</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Apps List */}
        <Card>
          <CardHeader>
            <CardTitle>Applications ({summaryData?.app_count || 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            {appUsage.map((a: any, idx: number) => (
              <UsageBar key={`${a.name}-${idx}`} label={a.name} minutes={a.minutes} max={appMax} category={a.category} />
            ))}
            {appUsage.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-10">No application events recorded.</p>
            )}
          </CardContent>
        </Card>

        {/* Sites List */}
        <Card>
          <CardHeader>
            <CardTitle>Websites ({summaryData?.site_count || 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            {siteUsage.map((s: any, idx: number) => (
              <UsageBar key={`${s.domain}-${idx}`} label={s.domain} minutes={s.minutes} max={siteMax} category={s.category} />
            ))}
            {siteUsage.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-10">No website visits recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Screenshots */}
      <Card>
        <CardHeader>
          <CardTitle>Screenshots ({summaryData?.screenshot_count || 0})</CardTitle>
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
            <p className="text-xs text-muted-foreground italic text-center py-10">No screenshots captured during this session.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}