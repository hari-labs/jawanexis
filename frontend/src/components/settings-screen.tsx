import { PageHeader } from "@/components/page-header"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { Avatar } from "@/components/ui/avatar"

interface SettingRow {
  label: string
  description: string
  defaultOn?: boolean
}

interface SettingsSection {
  title: string
  description: string
  rows: SettingRow[]
}

export function SettingsScreen({
  title,
  description,
  user,
  sections,
}: {
  title: string
  description: string
  user: { name: string; email: string; role: string; color: string }
  sections: SettingsSection[]
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={title} description={description} />

      {/* Profile */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal information visible across the workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar name={user.name} color={user.color} size={64} />
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium">Full name</label>
                <input defaultValue={user.name} className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring focus:bg-card" />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium">Email</label>
                <input defaultValue={user.email} className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm outline-none focus:border-ring focus:bg-card" />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button>Save changes</Button>
          </div>
        </CardContent>
      </Card>

      {sections.map((section) => (
        <Card key={section.title} className="mb-4">
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {section.rows.map((row, idx) => (
              <div
                key={row.label}
                className={
                  "flex items-center justify-between gap-4 py-3 " +
                  (idx !== section.rows.length - 1 ? "border-b border-border" : "")
                }
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="text-sm text-muted-foreground text-pretty">{row.description}</p>
                </div>
                <Toggle defaultOn={row.defaultOn} label={row.label} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
