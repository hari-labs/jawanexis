import { SettingsScreen } from "@/components/settings-screen"

export function InternSettings() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const userObj = {
    name: currentUser.name || "Intern User",
    email: currentUser.email || "intern@workspace.io",
    role: currentUser.role === "admin" ? "Program Admin" : (currentUser.role === "team_lead" ? "Team Lead" : "Intern"),
    color: currentUser.avatarColor || "oklch(0.55 0.22 295)"
  }

  return (
    <SettingsScreen
      title="Settings"
      description="Manage your profile and tracking preferences."
      user={userObj}
      sections={[
        {
          title: "Tracking preferences",
          description: "Control how your activity is recorded during work sessions.",
          rows: [
            { label: "Auto-start tracking", description: "Begin tracking automatically when you open the app.", defaultOn: true },
            { label: "Screenshot capture", description: "Allow periodic screenshots while tracking is active.", defaultOn: true },
            { label: "Idle detection", description: "Pause tracking after 5 minutes of inactivity.", defaultOn: true },
            { label: "Blur sensitive content", description: "Automatically blur password fields in captures.", defaultOn: false },
          ],
        },
        {
          title: "Notifications",
          description: "Choose what reminders and summaries you receive.",
          rows: [
            { label: "Daily summary", description: "Get an end-of-day recap of your productivity.", defaultOn: true },
            { label: "Break reminders", description: "Nudge me to take a break every 90 minutes.", defaultOn: false },
            { label: "Goal alerts", description: "Notify me when I hit my daily focus goal.", defaultOn: true },
          ],
        },
      ]}
    />
  )
}
