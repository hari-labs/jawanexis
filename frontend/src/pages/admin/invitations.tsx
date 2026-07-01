import { useEffect, useState } from "react"
import { getInvitations, createInvitation, resendInvitation } from "@/services/api"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { Mail, ShieldCheck, Copy, Check, RefreshCw } from "lucide-react"

export function Invitations() {
  const [invitations, setInvitations] = useState<any[]>([])
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("intern")
  const [sending, setSending] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [resendingToken, setResendingToken] = useState<string | null>(null)
  
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const adminEmail = currentUser.email || ""

  const loadInvitations = () => {
    getInvitations()
      .then((data) => setInvitations(data))
      .catch(() => {})
  }

  useEffect(() => {
    loadInvitations()
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setSending(true)
    try {
      const res = await createInvitation(email, role)
      if (res.success) {
        alert(res.message || `Invitation created successfully!\n\nLink: ${res.link}`)
        setEmail("")
        loadInvitations()
      } else {
        alert(res.message || "Failed to create invitation.")
      }
    } catch (err) {
      alert("Error creating invitation.")
    } finally {
      setSending(false)
    }
  }

  const handleResend = async (token: string) => {
    setResendingToken(token)
    try {
      const res = await resendInvitation(token)
      if (res.success) {
        alert("Invitation email resent successfully!")
        loadInvitations()
      } else {
        alert(res.message || "Failed to resend invitation email.")
      }
    } catch (err) {
      alert("Error resending email.")
    } finally {
      setResendingToken(null)
    }
  }

  const handleCopy = (token: string) => {
    const link = `${window.location.origin}/activate?token=${token}`
    navigator.clipboard.writeText(link)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Invitations" description="Manage access controls and invite new members to join the team." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Creation card */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Invite New User</CardTitle>
            <CardDescription>Send invitation links to team members</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="invite-email">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="h-10 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="invite-role">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:border-ring"
                >
                  <option value="intern">Intern</option>
                  <option value="team_lead">Team Lead</option>
                </select>
              </div>

              <Button type="submit" className="mt-2" disabled={sending}>
                {sending ? "Sending..." : "Create Invitation"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* History card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sent Invitations</CardTitle>
            <CardDescription>Monitor status and share registration links</CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Email Sent</th>
                      <th className="py-2.5 px-3">Sent At</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.token} className="border-b border-border last:border-0 hover:bg-secondary/20">
                        <td className="py-3 px-3 font-medium truncate max-w-[180px]" title={inv.email}>
                          {inv.email}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="neutral">
                            {inv.role === "team_lead" ? "Team Lead" : "Intern"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={inv.status === "activated" ? "success" : "warning"}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={inv.delivery_status === "success" ? "success" : inv.delivery_status === "failed" ? "danger" : "neutral"}>
                            {inv.delivery_status || "pending"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {inv.email_sent_at ? new Date(inv.email_sent_at).toLocaleString() : (inv.created_at ? new Date(inv.created_at).toLocaleString() : "-")}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {inv.status === "pending" ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="inline-flex items-center gap-1.5"
                                onClick={() => handleResend(inv.token)}
                                disabled={resendingToken === inv.token}
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${resendingToken === inv.token ? 'animate-spin' : ''}`} />
                                Resend
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="inline-flex items-center gap-1.5"
                                onClick={() => handleCopy(inv.token)}
                              >
                                {copiedToken === inv.token ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-green-500" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy Link
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Claimed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-10 text-sm text-muted-foreground">No invitations sent yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
