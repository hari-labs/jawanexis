import { SettingsScreen } from "@/components/settings-screen"

export function AdminSettings() {
  return (
    <SettingsScreen
      title="Settings"
      description="Manage your workspace, monitoring policies, and notifications."
      user={{ name: "Jordan Wells", email: "jordan.wells@nova.io", role: "Program Admin", color: "oklch(0.55 0.22 295)" }}
      sections={[
        {
          title: "Monitoring policy",
          description: "Control what is tracked across all interns.",
          rows: [
            { label: "Screenshot capture", description: "Capture periodic screenshots every 10 minutes.", defaultOn: true },
            { label: "Application tracking", description: "Record active applications and time spent.", defaultOn: true },
            { label: "Website tracking", description: "Record visited domains during tracked sessions.", defaultOn: true },
            { label: "Idle detection", description: "Pause tracking after 5 minutes of inactivity.", defaultOn: true },
            { label: "Blur sensitive screens", description: "Automatically blur captures of password fields.", defaultOn: false },
          ],
        },
        {
          title: "Notifications",
          description: "Choose when your team gets notified.",
          rows: [
            { label: "Low productivity alerts", description: "Notify when an intern drops below 60%.", defaultOn: true },
            { label: "Daily summary email", description: "Receive a daily digest of team activity.", defaultOn: true },
            { label: "Weekly reports", description: "Email exported reports every Monday.", defaultOn: false },
          ],
        },
      ]}
    />
  )
}
