import { useEffect, useState } from "react"
import { Calendar, ChevronDown, X, Clock, AppWindow, Activity, Camera } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { getUsers, getScreenshots, getAssignedProjects } from "@/services/api"
import { BASE_URL } from "@/services/api";

interface Screenshot {
    id: string
    hour: string
    time: string
    app: string
    window_title?: string
    activity: number
    file_path: string
    user_name?: string
    session_id?: string
    captured_at?: string
    cloudinary_url?: string
    uploaded_to_cloud?: boolean
}

interface ScreenshotGroup {
    hour: string
    shots: Screenshot[]
}

export function TeamScreenshots() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const isIntern = currentUser.role === "intern"
  const isTeamLead = currentUser.role === "team_lead" || currentUser.role === "team lead"

  const [users, setUsers] = useState<any[]>([])
  const [internId, setInternId] = useState("")
  const [screenshotHours, setScreenshotHours] = useState<ScreenshotGroup[]>([])

  const getLocalDateString = () => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const [date, setDate] = useState(getLocalDateString())
  const [internOpen, setInternOpen] = useState(false)
  const [preview, setPreview] = useState<Screenshot | null>(null)

  useEffect(() => {
      if (isIntern) {
          // Normalize id if database field differs
          const uid = currentUser.id || currentUser.user_id || ""
          setUsers([{ id: uid, name: currentUser.name, avatarColor: currentUser.avatarColor }])
          setInternId(uid)
          return
      }
      if (isTeamLead) {
          Promise.all([getUsers(), getAssignedProjects(currentUser.id)])
              .then(([allUsers, projects]) => {
                  const assignedMemberIds = new Set(
                      projects.flatMap((p: any) => p.members?.map((m: any) => m.id) || [])
                  )
                  const filtered = allUsers.filter((u: any) => 
                      u.id === currentUser.id || (u.role.toLowerCase() === "intern" && assignedMemberIds.has(u.id))
                  )
                  setUsers(filtered)
                  setInternId(currentUser.id)
              })
              .catch(err => console.error(err))
      } else {
          getUsers()
              .then(data => {
                  const filtered = data.filter((u: any) => 
                      u.role.toLowerCase() === "intern" || u.role.toLowerCase() === "team_lead" || u.role.toLowerCase() === "team lead"
                  )
                  setUsers(filtered)
                  if (filtered.length > 0) {
                      setInternId(filtered[0].id)
                  }
              })
              .catch(err => console.error(err))
      }
  }, [isIntern, isTeamLead])

  useEffect(() => {
      if (!internId) return;
      getScreenshots(internId, date)
          .then(data => {
            const sorted = [...data].sort((a: ScreenshotGroup, b: ScreenshotGroup) => b.hour.localeCompare(a.hour))
            setScreenshotHours(sorted)
          })
  }, [internId, date])

  const intern = users.find((i) => i.id === internId)
  const total = screenshotHours.reduce((a, h) => a + h.shots.length, 0)

  if (!intern) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">No team members recorded.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={isIntern ? "My Screenshots" : "Team Screenshots"} description={isIntern ? "Periodic captures grouped by day and hour for your active session." : "Periodic captures grouped by day and hour for team members."}>
        <Badge variant="primary">
          <Camera className="h-3.5 w-3.5" />
          {total} captures
        </Badge>
      </PageHeader>

      {/* Controls */}
      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        {!isIntern ? (
          <div className="relative">
            <button
              onClick={() => setInternOpen((v) => !v)}
              className="flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 text-sm font-medium sm:w-64"
            >
              <Avatar name={intern.name} color={intern.avatarColor} size={24} />
              {intern.name}
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
            </button>
            {internOpen && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg sm:w-64">
                {users.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => {
                      setInternId(i.id)
                      setInternOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <Avatar name={i.name} color={i.avatarColor} size={24} />
                    {i.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 text-sm font-medium">
            <Avatar name={intern.name} color={intern.avatarColor} size={24} />
            <span className="text-muted-foreground">Screenshots for:</span>
            <span className="font-semibold">{intern.name}</span>
          </div>
        )}

        <div className="relative sm:w-48">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
          />
        </div>
      </Card>

      {/* Grouped by hour */}
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
              {group.shots.map((shot) => (
                <button
                  key={shot.id}
                  onClick={() => setPreview(shot)}
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
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground truncate max-w-[120px]" title={shot.user_name}>
                        {shot.user_name || "Unknown"}
                      </span>
                      <span
                        className="text-xs font-semibold tabular-nums"
                        style={{ color: shot.activity >= 70 ? "oklch(0.55 0.15 150)" : shot.activity >= 40 ? "oklch(0.6 0.13 65)" : "oklch(0.6 0.2 25)" }}
                      >
                        {shot.activity}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="truncate max-w-[110px]" title={shot.app}>
                        {shot.app}
                      </span>
                      <span className="font-mono">
                        {shot.captured_at ? new Date(shot.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : shot.time}
                      </span>
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground/80 truncate">
                      Sess: {shot.session_id || "N/A"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
        {screenshotHours.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">No screenshots captured for this date.</p>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={preview.user_name || intern.name} color={intern.avatarColor} size={32} />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{preview.user_name || intern.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {preview.app} {preview.window_title ? `— ${preview.window_title}` : ""} · {preview.time}
                  </p>
                </div>
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
            <div className="flex flex-wrap items-center gap-6 px-5 py-3 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-4 w-4" />
                Activity level
                <span className="font-semibold text-foreground">{preview.activity}%</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                Captured at <span className="font-semibold text-foreground">{preview.captured_at ? new Date(preview.captured_at).toLocaleString() : preview.time}</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground font-mono text-xs">
                Session: <span className="font-semibold text-foreground">{preview.session_id || "N/A"}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}