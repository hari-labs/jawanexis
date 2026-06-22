import { useEffect, useState } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/status-badge"
import { ProductivityRing } from "@/components/productivity-ring"
import { getUsers, type Status } from "@/services/api"

export function TeamMembers() {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Status | "all">("all")
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    getUsers().then((data) => setUsers(data))
  }, [])

  // Filter only interns (the team members)
  const teamMembers = users.filter((u) => u.role.toLowerCase() === "intern")

  const filtered = teamMembers.filter((i) => {
    const matchesQuery = i.name.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === "all" || i.status === filter
    return matchesQuery && matchesFilter
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Team Members" description={`${teamMembers.length} interns assigned to your team`} />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team members…"
              className="h-10 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-secondary/40 p-0.5">
              {(["all", "active", "paused", "offline"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setFilter(v)}
                  className={
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors capitalize " +
                    (filter === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Current App</th>
                <th className="px-4 py-3 font-medium">Current Site</th>
                <th className="px-4 py-3 font-medium">Work Hours</th>
                <th className="px-4 py-3 font-medium">Productivity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3 flex items-center gap-3">
                    <Avatar name={i.name} color={i.avatarColor} size={36} />
                    <div className="leading-tight">
                      <p className="font-semibold">{i.name}</p>
                      <p className="text-xs text-muted-foreground">{i.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{i.currentApp || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.currentSite || "-"}</td>
                  <td className="px-4 py-3 tabular-nums">{i.workHours}h</td>
                  <td className="px-4 py-3">
                    <ProductivityRing value={i.productivity} size={40} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No team members match your filters.</p>
        )}
      </Card>
    </div>
  )
}
