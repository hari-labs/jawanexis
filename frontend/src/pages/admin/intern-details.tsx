import { useParams, Link, useNavigate } from "react-router-dom"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import {
  ArrowLeft,
  AppWindow,
  Globe,
  ListChecks,
  Clock,
  Coffee,
  Mail,
  MapPin,
  Calendar,
  Camera,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { ProductivityRing } from "@/components/productivity-ring"
import { interns, productivityTrend, recentActivity } from "@/data/mock"

export function InternDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const intern = interns.find((i) => i.id === id)

  if (!intern) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-lg font-semibold">Intern not found</p>
        <Button onClick={() => navigate("/admin/interns")}>Back to interns</Button>
      </div>
    )
  }

  const activity = recentActivity.filter((e) => e.internId === intern.id)
  const infoItems = [
    { icon: Mail, label: "Email", value: intern.email },
    { icon: MapPin, label: "Timezone", value: intern.timezone },
    { icon: Calendar, label: "Joined", value: intern.joinedDate },
  ]
  const metrics = [
    { icon: AppWindow, label: "Current app", value: intern.currentApp },
    { icon: Globe, label: "Current site", value: intern.currentSite },
    { icon: ListChecks, label: "Assigned task", value: intern.task },
    { icon: Clock, label: "Work time", value: `${intern.workHours}h` },
    { icon: Coffee, label: "Break time", value: `${intern.breakHours}h` },
  ]

  return (
    <div>
      <Link to="/admin/interns" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to interns
      </Link>

      {/* Profile header */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={intern.name} color={intern.avatarColor} size={60} />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{intern.name}</h1>
              <p className="text-sm text-muted-foreground">{intern.role}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={intern.status} />
                <span className="text-xs text-muted-foreground">Active {intern.lastActive.toLowerCase()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <ProductivityRing value={intern.productivity} size={56} />
              <p className="mt-1 text-xs text-muted-foreground">Productivity</p>
            </div>
            <Link to="/admin/screenshots">
              <Button variant="outline">
                <Camera className="h-4 w-4" />
                Screenshots
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile information</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {infoItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="truncate text-sm font-medium">{item.value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current session</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {metrics.map((m) => (
                <div key={m.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <m.icon className="h-4 w-4" />
                    {m.label}
                  </span>
                  <span className="truncate text-sm font-medium">{m.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Productivity this week</CardTitle>
              <CardDescription>Daily productivity score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={productivityTrend} margin={{ left: -20, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="detail" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 13 }} />
                    <Area type="monotone" dataKey="productivity" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#detail)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length > 0 ? (
                <ul className="flex flex-col gap-4">
                  {activity.map((e) => (
                    <li key={e.id} className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{e.action}</p>
                        <p className="truncate text-xs text-muted-foreground">{e.detail}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{e.time}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
