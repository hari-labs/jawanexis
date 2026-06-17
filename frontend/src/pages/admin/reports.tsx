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
import { Download, AppWindow, Globe, Gauge, Clock } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { productivityTrend } from "@/data/mock"
import { getAppUsage, getSiteUsage, categoryColor } from "@/services/api"

const tabs = [
  { id: "apps", label: "Application usage", icon: AppWindow },
  { id: "sites", label: "Website usage", icon: Globe },
  { id: "productivity", label: "Productivity", icon: Gauge },
  { id: "worktime", label: "Work time", icon: Clock },
] as const

type Tab = (typeof tabs)[number]["id"]

const categoryTotals = (data: { category: string; minutes: number }[]) => {
  const totals: Record<string, number> = { productive: 0, neutral: 0, distracting: 0 }
  data.forEach((d) => (totals[d.category] += d.minutes))
  return Object.entries(totals).map(([category, minutes]) => ({ category, minutes }))
}

export function Reports() {
  const [tab, setTab] = useState<Tab>("apps")
  const [appUsage, setAppUsage] = useState<any[]>([])
  const [siteUsage, setSiteUsage] = useState<any[]>([])

  useEffect(() => {
      getAppUsage()
          .then(data => setAppUsage(data))

      getSiteUsage()
          .then(data => setSiteUsage(data))
  }, [])

  return (
    <div>
      <PageHeader title="Reports" description="Aggregated analytics across your intern program.">
        <Button variant="outline">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </PageHeader>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-secondary/40 p-1">
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
      {tab === "productivity" && <ProductivityReport />}
      {tab === "worktime" && <WorkTimeReport />}
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

function ProductivityReport() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Productivity analytics</CardTitle>
        <CardDescription>Team-wide productivity score over the week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={productivityTrend} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="rep-prod" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 13 }} />
              <Area type="monotone" dataKey="productivity" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#rep-prod)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function WorkTimeReport() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Work time report</CardTitle>
        <CardDescription>Total tracked hours per day across all interns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={productivityTrend} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
              <Tooltip cursor={{ fill: "var(--color-secondary)" }} formatter={(v) => [`${Number(v ?? 0)}h`, "Hours"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 13 }} />
              <Bar dataKey="hours" radius={[6, 6, 0, 0]} barSize={40} fill="var(--color-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
