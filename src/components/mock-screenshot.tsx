import { cn } from "@/lib/utils"

// A lightweight CSS mock of a captured desktop screenshot for the prototype.
const themes: Record<string, { bar: string; bg: string; accent: string }> = {
  "VS Code": { bar: "oklch(0.3 0.02 285)", bg: "oklch(0.22 0.015 285)", accent: "oklch(0.7 0.15 200)" },
  Terminal: { bar: "oklch(0.25 0 0)", bg: "oklch(0.16 0 0)", accent: "oklch(0.68 0.16 150)" },
  Figma: { bar: "oklch(0.96 0 0)", bg: "oklch(0.99 0 0)", accent: "oklch(0.65 0.2 20)" },
  Chrome: { bar: "oklch(0.95 0.005 286)", bg: "oklch(0.99 0 0)", accent: "oklch(0.55 0.22 295)" },
  Notion: { bar: "oklch(0.98 0 0)", bg: "oklch(1 0 0)", accent: "oklch(0.5 0.02 285)" },
  Slack: { bar: "oklch(0.3 0.05 300)", bg: "oklch(0.98 0 0)", accent: "oklch(0.62 0.18 330)" },
  YouTube: { bar: "oklch(0.98 0 0)", bg: "oklch(1 0 0)", accent: "oklch(0.62 0.22 25)" },
}

export function MockScreenshot({ app, className }: { app: string; className?: string }) {
  const t = themes[app] ?? themes["Chrome"]
  const light = t.bg.includes("0.9") || t.bg.includes("0.99") || t.bg.includes("1 0 0")

  return (
    <div className={cn("flex h-full w-full flex-col overflow-hidden", className)} style={{ backgroundColor: t.bg }}>
      {/* Title bar */}
      <div className="flex items-center gap-1 px-2 py-1.5" style={{ backgroundColor: t.bar }}>
        <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.65_0.2_25)]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.75_0.15_75)]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.68_0.16_150)]" />
      </div>
      {/* Body */}
      <div className="flex flex-1 gap-1.5 p-2">
        <div className="flex w-1/4 flex-col gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full"
              style={{ backgroundColor: light ? "oklch(0.9 0.005 286)" : "oklch(0.35 0.01 285)", width: `${70 - i * 8}%` }}
            />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <span className="h-2 w-1/2 rounded" style={{ backgroundColor: t.accent }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full"
              style={{
                backgroundColor: light ? "oklch(0.92 0.005 286)" : "oklch(0.32 0.01 285)",
                width: `${90 - (i % 3) * 18}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
