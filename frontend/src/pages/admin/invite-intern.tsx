import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { ArrowLeft, Mail, Plus, X, Send, Check, Copy } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const roles = ["Frontend Intern", "Backend Intern", "Design Intern", "Data Intern", "Marketing Intern", "QA Intern"]

export function InviteIntern() {
  const navigate = useNavigate()
  const [emails, setEmails] = useState<string[]>([])
  const [input, setInput] = useState("")
  const [role, setRole] = useState(roles[0])
  const [sent, setSent] = useState(false)

  function addEmail() {
    const value = input.trim()
    if (value && !emails.includes(value)) {
      setEmails([...emails, value])
      setInput("")
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (emails.length === 0 && input.trim()) addEmail()
    setSent(true)
    setTimeout(() => navigate("/admin/interns"), 1600)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/admin/interns" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to interns
      </Link>

      <PageHeader title="Invite interns" description="Send onboarding invitations and assign a starting role." />

      <Card>
        <CardHeader>
          <CardTitle>Invitation details</CardTitle>
          <CardDescription>Interns receive an email with a setup link to install the tracker.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[oklch(0.94_0.05_150)] text-[oklch(0.45_0.15_150)]">
                <Check className="h-6 w-6" />
              </span>
              <p className="text-lg font-semibold">Invitations sent</p>
              <p className="text-sm text-muted-foreground">
                {emails.length || 1} invitation{emails.length === 1 ? "" : "s"} on the way. Redirecting…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email addresses</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addEmail()
                        }
                      }}
                      placeholder="name@company.com"
                      type="email"
                      className="h-11 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={addEmail}>
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
                {emails.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {emails.map((email) => (
                      <span key={email} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                        {email}
                        <button type="button" onClick={() => setEmails(emails.filter((e) => e !== email))} aria-label={`Remove ${email}`}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Assign role</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {roles.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={
                        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors " +
                        (role === r
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border text-muted-foreground hover:bg-secondary")
                      }
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Shareable invite link</p>
                    <p className="text-xs text-muted-foreground">pulse.app/join/nova-2025</p>
                  </div>
                  <Button type="button" variant="secondary" size="sm">
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate("/admin/interns")}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Send className="h-4 w-4" />
                  Send invitations
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
