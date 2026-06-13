import { Badge } from "@/components/ui/badge"
import type { Status } from "@/data/mock"

const map: Record<Status, { label: string; variant: "success" | "warning" | "neutral"; dot: string }> = {
  active: { label: "Active", variant: "success", dot: "oklch(0.6 0.16 150)" },
  paused: { label: "Paused", variant: "warning", dot: "oklch(0.7 0.16 65)" },
  offline: { label: "Offline", variant: "neutral", dot: "oklch(0.65 0.02 286)" },
}

export function StatusBadge({ status }: { status: Status }) {
  const s = map[status]
  return (
    <Badge variant={s.variant}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </Badge>
  )
}
