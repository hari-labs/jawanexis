import { cn } from "@/lib/utils"
import { getInitials } from "@/lib/utils"

export function Avatar({
  name,
  color,
  size = 36,
  className,
}: {
  name: string
  color?: string
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: color ?? "oklch(0.55 0.22 295)",
        fontSize: size * 0.38,
      }}
      aria-hidden
    >
      {getInitials(name)}
    </span>
  )
}
