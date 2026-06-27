import { useEffect, useState } from "react"
import { getTeamOverview, getAllEvidence } from "@/services/api"
import { BASE_URL } from "@/services/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { PageHeader } from "@/components/page-header"
import { Shield, Folder, FileText, CheckCircle, XCircle, Clock } from "lucide-react"

export function TeamOverview() {
  const [teams, setTeams] = useState<any[]>([])
  const [evidenceList, setEvidenceList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getTeamOverview(), getAllEvidence()])
      .then(([teamsData, evidenceData]) => {
        setTeams(teamsData)
        setEvidenceList(evidenceData)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading team overview data...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Team Overview" description="Monitor Team Leads, assigned interns, active project scopes, and aggregate performance metrics." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {teams.map((t, idx) => (
          <Card key={t.lead.id || idx} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-4 border-b border-sidebar-border">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={t.lead.name} size={40} color="oklch(0.6 0.2 295)" />
                  <div>
                    <CardTitle className="text-lg">{t.lead.name}</CardTitle>
                    <CardDescription>{t.lead.email || "No Email"} · Team Lead</CardDescription>
                  </div>
                </div>
                <Badge variant="primary" className="h-fit">
                  <Shield className="h-3 w-3 mr-1" /> Lead
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col gap-4">
              {/* Project Scope */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Project Scope</h4>
                <Badge variant={t.project.status === "completed" ? "success" : "neutral"}>
                  <Folder className="h-3 w-3 mr-1" /> {t.project.name}
                </Badge>
              </div>

              {/* Members */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Team Members ({t.metrics.member_count})</h4>
                {t.members.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-secondary/30 border-b border-border text-muted-foreground font-medium uppercase tracking-wider">
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3 text-center">Productivity</th>
                          <th className="py-2 px-3 text-center">Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.members.map((m: any) => (
                          <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/10">
                            <td className="py-2 px-3 font-semibold text-foreground flex items-center gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full ${m.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {m.name}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">{m.productivity}%</td>
                            <td className="py-2 px-3 text-center font-mono">{m.workHours}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No members assigned.</p>
                )}
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Team Avg Productivity:</span>
                  <p className="text-lg font-semibold text-foreground mt-0.5">{t.metrics.avg_productivity}%</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Hours Tracked:</span>
                  <p className="text-lg font-semibold text-foreground mt-0.5">{t.metrics.total_work_hours}h</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {teams.length === 0 && (
          <p className="text-sm text-muted-foreground py-10 col-span-2 text-center">No active projects or teams assigned.</p>
        )}
      </div>

      {/* Global Task Evidence Log */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Global Task Evidence Log</CardTitle>
          <CardDescription>View all task completion evidence and approval history across the organization</CardDescription>
        </CardHeader>
        <CardContent>
          {evidenceList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-4">Intern</th>
                    <th className="py-3 px-4">Project / Task</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4">Evidence</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceList.map((ev) => (
                    <tr key={ev._id} className="border-b border-border last:border-0 hover:bg-secondary/10">
                      <td className="py-3 px-4 font-semibold text-foreground">{ev.user_name || "Unknown"}</td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-muted-foreground block">{ev.project_name || "General"}</span>
                        <span className="font-medium text-foreground">{ev.task_title || "Untitled Task"}</span>
                      </td>
                      <td className="py-3 px-4 max-w-[200px] truncate text-muted-foreground" title={ev.notes}>
                        {ev.notes || <span className="italic text-xs">No notes provided</span>}
                      </td>
                      <td className="py-3 px-4">
                        {ev.file_path ? (
                          <a
                            href={`${BASE_URL}/${ev.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                          >
                            <FileText className="h-3.5 w-3.5" /> View File
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No attachment</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={ev.status === "approved" ? "success" : ev.status === "rejected" ? "danger" : "warning"}>
                          {ev.status === "approved" ? (
                            <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Approved</span>
                          ) : ev.status === "rejected" ? (
                            <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Rejected</span>
                          ) : (
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>
                          )}
                        </Badge>
                        {ev.feedback && (
                          <span className="text-xs text-destructive block mt-1">FB: {ev.feedback}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {ev.submitted_at ? ev.submitted_at.slice(0, 16).replace('T', ' ') : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-10 text-sm text-muted-foreground">No task evidence has been submitted yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}