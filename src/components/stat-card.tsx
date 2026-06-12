import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  delta,
  trend = "up",
  icon: Icon,
}: {
  label: string
  value: string
  delta?: string
  trend?: "up" | "down"
  icon: LucideIcon
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {delta && (
        <p className="mt-3 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "font-semibold",
              trend === "up" ? "text-[oklch(0.55_0.15_150)]" : "text-[oklch(0.55_0.2_25)]",
            )}
          >
            {trend === "up" ? "▲" : "▼"} {delta}
          </span>
          <span className="text-muted-foreground">vs last week</span>
        </p>
      )}
    </Card>
  )
}
