import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { MockScreenshot } from "@/components/mock-screenshot"
import { appUsage, siteUsage, screenshotHours, categoryColor } from "@/data/mock"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts"

function fmt(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function UsageBar({ label, minutes, max, category }: { label: string; minutes: number; max: number; category: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{fmt(minutes)}</span>
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
  const appMax = Math.max(...appUsage.map((a) => a.minutes))
  const siteMax = Math.max(...siteUsage.map((s) => s.minutes))
  const chartData = [...appUsage].sort((a, b) => b.minutes - a.minutes).slice(0, 6)

  return (
    <div className="space-y-6">
      <PageHeader title="My activity" description="A detailed log of your apps, websites, and captures." />

      <Card>
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
                formatter={(v: number) => fmt(v)}
              />
              <Bar dataKey="minutes" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {appUsage.map((a) => (
              <UsageBar key={a.name} label={a.name} minutes={a.minutes} max={appMax} category={a.category} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Websites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {siteUsage.map((s) => (
              <UsageBar key={s.domain} label={s.domain} minutes={s.minutes} max={siteMax} category={s.category} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent screenshots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {screenshotHours.map((group) => (
            <div key={group.hour} className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.hour}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {group.shots.map((shot) => (
                  <div key={shot.id} className="space-y-1.5">
                    <MockScreenshot app={shot.app} seed={shot.id} />
                    <div className="flex items-center justify-between px-0.5">
                      <span className="font-mono text-xs text-muted-foreground">{shot.time}</span>
                      <Badge variant={shot.activity > 60 ? "success" : "warning"}>{shot.activity}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
