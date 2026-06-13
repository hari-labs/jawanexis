import { useNavigate, Link } from "react-router-dom"
import { Zap, Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Login({ role }: { role: "admin" | "intern" }) {
  const navigate = useNavigate()
  const isAdmin = role === "admin"

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate(isAdmin ? "/admin" : "/intern")
  }

  return (
    <div className="flex min-h-screen">
      {/* Form panel */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Pulse</p>
              <p className="text-xs text-muted-foreground">Productivity OS</p>
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {isAdmin ? "Sign in to your workspace" : "Welcome back, intern"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            {isAdmin
              ? "Monitor productivity, manage your interns, and review reports."
              : "Pick a task, start tracking, and watch your productivity grow."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  defaultValue={isAdmin ? "jordan.wells@nova.io" : "amelia.cho@nova.io"}
                  className="h-11 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <button type="button" className="text-xs font-medium text-primary hover:underline">
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  defaultValue="demo-password"
                  className="h-11 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
                />
              </div>
            </div>

            <Button type="submit" size="lg" className="mt-2 w-full">
              Sign in as {isAdmin ? "Admin" : "Intern"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isAdmin ? (
              <>
                Are you an intern?{" "}
                <Link to="/login/intern" className="font-medium text-primary hover:underline">
                  Sign in here
                </Link>
              </>
            ) : (
              <>
                Are you an admin?{" "}
                <Link to="/" className="font-medium text-primary hover:underline">
                  Sign in here
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:w-1/2">
        <div className="flex items-center gap-2 text-sm font-medium opacity-90">
          <ShieldCheck className="h-4 w-4" />
          Enterprise-grade intern monitoring
        </div>

        <div>
          <h2 className="text-3xl font-semibold leading-tight text-balance">
            Understand how your interns really work.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed opacity-80">
            Track applications, websites, screenshots, and productivity in real time. Coach your team with data, not
            guesswork.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { v: "128", l: "Interns" },
              { v: "94%", l: "Avg uptime" },
              { v: "12k", l: "Hours tracked" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-white/10 p-4">
                <p className="text-2xl font-semibold tabular-nums">{s.v}</p>
                <p className="text-xs opacity-80">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs opacity-70">Demo prototype — no real credentials required.</p>
      </div>
    </div>
  )
}
