import { useState, useEffect } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { logoutUser } from "@/services/api"
import { BASE_URL } from "@/services/api";
import {
  LayoutDashboard,
  Users,
  Camera,
  FileBarChart,
  Settings,
  Activity,
  ListChecks,
  Search,
  Bell,
  Menu,
  X,
  Zap,
  ArrowLeftRight,
  Mail,
  FolderKanban,
  UserCheck,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"

type Role = "admin" | "team_lead" | "intern"

const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/invitations", label: "Invitations", icon: Mail },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/analytics", label: "Analytics", icon: FileBarChart },
  { to: "/admin/screenshots", label: "Screenshots", icon: Camera },
  { to: "/admin/settings", label: "Settings", icon: Settings },
]

const teamLeadNav = [
  { to: "/team-lead", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/team-lead/activity", label: "Activity", icon: Activity },
  { to: "/team-lead/projects", label: "My Projects", icon: FolderKanban },
  { to: "/team-lead/analytics", label: "Team Analytics", icon: FileBarChart },
  { to: "/team-lead/screenshots", label: "Team Screenshots", icon: Camera },
]

const internNav = [
  { to: "/intern", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/intern/activity", label: "Activity", icon: Activity },
  { to: "/intern/projects", label: "Projects", icon: FolderKanban },
  { to: "/intern/screenshots", label: "Screenshots", icon: Camera },
]

export function AppLayout({ role }: { role: Role }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const nav = role === "admin" ? adminNav : (role === "team_lead" ? teamLeadNav : internNav)
  const switchTo = role === "admin" ? "/intern" : "/admin"
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const storedUserStr = localStorage.getItem("user")
    if (!storedUserStr) {
      navigate("/", { replace: true })
      return
    }
    try {
      const parsedUser = JSON.parse(storedUserStr)
      
      // Perform live re-validation of user role and activation status
      fetch(`${BASE_URL}/auth/me/${parsedUser.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            const updatedUser = data.user
            if (updatedUser.role !== parsedUser.role || !updatedUser.is_active) {
              if (!updatedUser.is_active) {
                localStorage.removeItem("user")
                navigate("/", { replace: true })
                return
              }
              localStorage.setItem("user", JSON.stringify(updatedUser))
              if (updatedUser.role === "admin") navigate("/admin", { replace: true })
              else if (updatedUser.role === "team_lead") navigate("/team-lead", { replace: true })
              else navigate("/intern", { replace: true })
              return
            }
          }
        }).catch(() => {})

      if (parsedUser.role !== role) {
        if (parsedUser.role === "admin") navigate("/admin", { replace: true })
        else if (parsedUser.role === "team_lead") navigate("/team-lead", { replace: true })
        else navigate("/intern", { replace: true })
        return
      }
      setCurrentUser(parsedUser)
    } catch (e) {
      localStorage.removeItem("user")
      navigate("/", { replace: true })
    }
  }, [role, navigate])

  const handleLogout = async () => {
    try {
      await logoutUser()
    } catch (e) {}
    localStorage.removeItem("user")
    navigate("/", { replace: true })
  }

  const user = currentUser
    ? {
        name: currentUser.name,
        sub: currentUser.role === "admin"
          ? "Program Admin"
          : (currentUser.role === "team_lead" ? "Team Lead" : "Workspace Intern"),
        color: currentUser.avatarColor || "oklch(0.55 0.22 295)"
      }
    : { name: "Guest User", sub: "Workspace Member", color: "oklch(0.55 0.22 295)" }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Pulse</p>
            <p className="text-xs text-muted-foreground">Productivity OS</p>
          </div>
        </div>

        <div className="px-3 pb-2">
          <p className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {role === "admin" ? "Administration" : (role === "team_lead" ? "Management" : "Workspace")}
          </p>
          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-secondary",
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-3 flex flex-col gap-2">
          {currentUser && currentUser.role === "admin" && (
            <NavLink
              to={switchTo}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
            >
              <ArrowLeftRight className="h-[18px] w-[18px]" />
              Switch to {role === "admin" ? "Intern" : "Admin"}
            </NavLink>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign Out
          </button>
          <div className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2">
            <Avatar name={user.name} color={user.color} size={36} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.sub}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-secondary lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="relative hidden max-w-sm flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search interns, apps, reports…"
              className="h-10 w-full rounded-lg border border-border bg-secondary/50 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:bg-card"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.6_0.16_150)]" />
              Live monitoring
            </span>
            <button
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-secondary"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive" />
            </button>
            <Avatar name={user.name} color={user.color} size={32} />
          </div>
        </header>

        <main key={location.pathname} className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}