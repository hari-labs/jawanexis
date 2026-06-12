import { cn } from "@/lib/utils"

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger"
type Size = "sm" | "md" | "lg" | "icon"

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-[oklch(0.5_0.22_295)] shadow-sm",
  secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
  outline: "border border-border bg-card text-foreground hover:bg-secondary",
  ghost: "text-foreground hover:bg-secondary",
  danger: "bg-destructive text-destructive-foreground hover:opacity-90",
}

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-base gap-2",
  icon: "h-9 w-9",
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: {
  variant?: Variant
  size?: Size
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
