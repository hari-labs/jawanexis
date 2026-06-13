import { cn } from "@/lib/utils"

type Variant = "default" | "primary" | "success" | "warning" | "danger" | "neutral" | "outline"

const variants: Record<Variant, string> = {
  default: "bg-secondary text-secondary-foreground",
  primary: "bg-accent text-accent-foreground",
  success: "bg-[oklch(0.94_0.05_150)] text-[oklch(0.45_0.15_150)]",
  warning: "bg-[oklch(0.95_0.06_75)] text-[oklch(0.5_0.13_60)]",
  danger: "bg-[oklch(0.95_0.04_20)] text-[oklch(0.52_0.2_25)]",
  neutral: "bg-muted text-muted-foreground",
  outline: "border border-border text-foreground",
}

export function Badge({
  variant = "default",
  className,
  ...props
}: { variant?: Variant } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
