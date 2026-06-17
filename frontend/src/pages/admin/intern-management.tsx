import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Search, SlidersHorizontal, UserPlus, ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/status-badge"
import { ProductivityRing } from "@/components/productivity-ring"
import { getUsers, type Status } from "@/services/api"

const filters: { label: string; value: Status | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Offline", value: "offline" },
]

export function InternManagement() {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Status | "all">("all")
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
      getUsers()
        .then(data => setUsers(data))
  }, [])


  const filtered = users.filter((i) => {
    const matchesQuery =
      i.name.toLowerCase().includes(query.toLowerCase()) || i.role.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === "all" || i.status === filter
    return matchesQuery && matchesFilter
  })

  return (
    <div>
      <PageHeader title="Intern Management" description={`${users.length} interns in your program`}>
        <Link to="/admin/interns/invite">
          <Button>
            <UserPlus className="h-4 w-4" />
            Invite intern
          </Button>
        </Link>
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search interns…"
              className="h-10 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-secondary/40 p-0.5">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                    (filter === f.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" aria-label="More filters">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Table (desktop) */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Intern</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Current app</th>
                <th className="px-4 py-3 font-medium">Current site</th>
                <th className="px-4 py-3 font-medium">Work hours</th>
                <th className="px-4 py-3 font-medium">Productivity</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <Link to={`/admin/interns/${i.id}`} className="flex items-center gap-3">
                      <Avatar name={i.name} color={i.avatarColor} size={36} />
                      <div className="leading-tight">
                        <p className="font-medium">{i.name}</p>
                        <p className="text-xs text-muted-foreground">{i.role}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{i.currentApp}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.currentSite}</td>
                  <td className="px-4 py-3 tabular-nums">{i.workHours}h</td>
                  <td className="px-4 py-3">
                    <ProductivityRing value={i.productivity} size={40} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/interns/${i.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label={`View ${i.name}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards (mobile) */}
        <div className="flex flex-col gap-3 p-4 md:hidden">
          {filtered.map((i) => (
            <Link key={i.id} to={`/admin/interns/${i.id}`} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Avatar name={i.name} color={i.avatarColor} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{i.name}</p>
                <p className="truncate text-xs text-muted-foreground">{i.currentApp} · {i.workHours}h</p>
                <div className="mt-1"><StatusBadge status={i.status} /></div>
              </div>
              <ProductivityRing value={i.productivity} size={40} />
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No interns match your filters.</p>
        )}
      </Card>
    </div>
  )
}
