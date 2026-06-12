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
import { Users, Activity, Gauge, Clock, ArrowUpRight } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  interns,
  productivityTrend,
  appUsage,
  siteUsage,
  recentActivity,
  categoryColor,
} from "@/data/mock"

const activeCount = interns.filter((i) => i.status === "active").length
const avgProd = Math.round(interns.reduce((a, i) => a + i.productivity, 0) / interns.length)
const totalHours = interns.reduce((a, i) => a + i.workHours, 0).toFixed(0)

const topApps = [...appUsage].sort((a, b) => b.minutes - a.minutes).slice(0, 5)
const topSites = [...siteUsage].sort((a, b) => b.minutes - a.minutes).slice(0, 5)

export function AdminDashboard() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Real-time overview of your intern program's productivity.">
        <Link to="/admin/interns/invite">
          <Button>
            Invite intern
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total interns" value={String(interns.length)} delta="2" trend="up" icon={Users} />
        <StatCard label="Active now" value={String(activeCount)} delta="3" trend="up" icon={Activity} />
        <StatCard label="Avg productivity" value={`${avgProd}%`} delta="4%" trend="up" icon={Gauge} />
        <StatCard label="Work hours today" value={`${totalHours}h`} delta="6%" trend="up" icon={Clock} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
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
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest events across the team</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-4">
              {recentActivity.slice(0, 6).map((e) => {
                const intern = interns.find((i) => i.id === e.internId)
                return (
                  <li key={e.id} className="flex items-start gap-3">
                    <Avatar name={e.intern} color={intern?.avatarColor} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{e.intern}</span>{" "}
                        <span className="text-muted-foreground">{e.action.toLowerCase()}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{e.detail}</p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{e.time}</span>
                  </li>
                )
              })}
            </ul>
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
  title: string
  description: string
  data: { name: string; minutes: number; category: string }[]
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
                formatter={(v: number) => [`${Math.round(v / 60)}h ${v % 60}m`, "Time"]}
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
