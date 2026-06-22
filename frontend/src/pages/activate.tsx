import { useEffect, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { validateInvitation, activateInvitation } from "@/services/api"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Zap, User, Lock, ArrowRight } from "lucide-react"

export function Activate() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("")
  
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    if (!token) {
      setError("Missing invitation token.")
      setLoading(false)
      return
    }

    validateInvitation(token)
      .then((res) => {
        if (res.success) {
          setEmail(res.email)
          setRole(res.role)
        } else {
          setError(res.message || "Invitation is invalid or has expired.")
        }
        setLoading(false)
      })
      .catch(() => {
        setError("Error validating invitation.")
        setLoading(false)
      })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      alert("Name is required")
      return
    }
    if (password.length < 6) {
      alert("Password must be at least 6 characters")
      return
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match")
      return
    }

    setActivating(true)
    try {
      const res = await activateInvitation(token!, name, password)
      if (res.success) {
        alert("Account activated successfully! Redirecting to login.")
        navigate("/")
      } else {
        alert(res.message || "Failed to activate account.")
      }
    } catch (err) {
      alert("Error activating account.")
    } finally {
      setActivating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <p className="text-lg font-medium">Validating your invitation...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Link</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" />
          </span>
          <div className="leading-tight text-left">
            <p className="text-sm font-semibold">Pulse</p>
            <p className="text-xs text-muted-foreground">Productivity OS</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activate Account</CardTitle>
            <CardDescription>
              Set up your account for <strong>{email}</strong> as an <strong>{role === "team_lead" ? "Team Lead" : "Intern"}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="name">
                  Full Name
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="h-11 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
                  Create Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="h-11 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="confirm-password">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="h-11 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
                    required
                  />
                </div>
              </div>

              <Button type="submit" size="lg" className="mt-2 w-full" disabled={activating}>
                {activating ? "Activating..." : "Activate Account"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
