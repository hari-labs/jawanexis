import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { ProductivityRing } from "@/components/productivity-ring"
import { interns, productivityTrend, appUsageHistory, categoryColor } from "@/data/mock"
import { Clock, Coffee, Zap, Play, Pause, Target } from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

const me = interns[0]

export function InternDashboard() {
  const [tracking, setTracking] = useState(true)
  const [seconds, setSeconds] = useState(6 * 3600 + 24 * 60)

  useEffect(() => {
    if (!tracking) return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [tracking])

  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const clock = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${me.name.split(" ")[0]}`}
        description="Here is your activity summary for today."
      />

      {/* Tracking control */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                tracking ? "bg-chart-3/15 text-chart-3" : "bg-muted text-muted-foreground"
              }`}
            >
              {tracking ? <Zap className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
            </span>
            <div>
              <p className="text-sm text-muted-foreground">
                {tracking ? "Tracking active" : "Tracking paused"}
              </p>
              <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{clock}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-muted-foreground">Current task</p>
              <p className="text-sm font-medium text-foreground">{me.task}</p>
            </div>
            <Button
              variant={tracking ? "outline" : "default"}
              onClick={() => setTracking((t) => !t)}
            >
              {tracking ? (
                <>
                  <Pause className="h-4 w-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Resume
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Productivity" value={`${me.productivity}%`} delta="+4%" trend="up" icon={Zap} />
        <StatCard label="Work hours today" value={`${me.workHours}h`} delta="+0.5h" trend="up" icon={Clock} />
        <StatCard label="Break time" value={`${me.breakHours}h`} delta="-0.2h" trend="down" icon={Coffee} />
        <StatCard label="Tasks done" value="3" delta="+1" trend="up" icon={Target} />
      </div>

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
          <CardContent className="flex flex-col items-center gap-3 pb-8">
            <ProductivityRing value={me.productivity} size={150} />
            <p className="text-center text-sm text-muted-foreground text-pretty">
              You&apos;re in the top 15% of interns this week. Keep it up.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s activity timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {appUsageHistory.map((row, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg px-3 py-2.5 hover:bg-muted/60"
            >
              <span className="w-14 font-mono text-xs text-muted-foreground">{row.time}</span>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: categoryColor(row.category) }}
              />
              <span className="flex-1 text-sm font-medium text-foreground">{row.app}</span>
              <span className="hidden flex-1 text-sm text-muted-foreground sm:block">{row.site}</span>
              <span className="text-sm text-muted-foreground">{row.duration}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
