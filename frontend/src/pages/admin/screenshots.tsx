import { useState } from "react"
import { Calendar, ChevronDown, X, Clock, AppWindow, Activity, Camera } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { MockScreenshot } from "@/components/mock-screenshot"
import { interns, screenshotHours, type Screenshot } from "@/data/mock"

export function Screenshots() {
  const [internId, setInternId] = useState(interns[0].id)
  const [date, setDate] = useState("2025-06-12")
  const [internOpen, setInternOpen] = useState(false)
  const [preview, setPreview] = useState<Screenshot | null>(null)

  const intern = interns.find((i) => i.id === internId)!
  const total = screenshotHours.reduce((a, h) => a + h.shots.length, 0)

  return (
    <div>
      <PageHeader title="Screenshots" description="Periodic captures grouped by day and hour.">
        <Badge variant="primary">
          <Camera className="h-3.5 w-3.5" />
          {total} captures
        </Badge>
      </PageHeader>

      {/* Controls */}
      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
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
              {interns.map((i) => (
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

        <div className="relative sm:w-48">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
          />
        </div>

        <span className="text-sm text-muted-foreground sm:ml-auto">
          Capturing every 10 min · {intern.role}
        </span>
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
                    <MockScreenshot app={shot.app} />
                    <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {shot.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <AppWindow className="h-3.5 w-3.5 text-muted-foreground" />
                      {shot.app}
                    </span>
                    <span
                      className="text-xs font-semibold tabular-nums"
                      style={{ color: shot.activity >= 70 ? "oklch(0.55 0.15 150)" : shot.activity >= 40 ? "oklch(0.6 0.13 65)" : "oklch(0.6 0.2 25)" }}
                    >
                      {shot.activity}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
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
                <Avatar name={intern.name} color={intern.avatarColor} size={32} />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{intern.name}</p>
                  <p className="text-xs text-muted-foreground">{preview.app} · {preview.time}</p>
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
              <MockScreenshot app={preview.app} />
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
