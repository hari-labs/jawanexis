// Centralized dummy data for the Intern Productivity Tracking System prototype.

export type Status = "active" | "paused" | "offline"

export interface AppUsage {
  name: string
  category: "productive" | "neutral" | "distracting"
  minutes: number
}

export interface SiteUsage {
  domain: string
  category: "productive" | "neutral" | "distracting"
  minutes: number
}

export interface ActivityEvent {
  id: string
  internId: string
  intern: string
  action: string
  detail: string
  time: string
  type: "app" | "site" | "task" | "session" | "break"
}

export interface Intern {
  id: string
  name: string
  email: string
  role: string
  avatarColor: string
  status: Status
  productivity: number
  workHours: number
  breakHours: number
  currentApp: string
  currentSite: string
  task: string
  lastActive: string
  joinedDate: string
  timezone: string
}

export const interns: Intern[] = [
  {
    id: "amelia-cho",
    name: "Amelia Cho",
    email: "amelia.cho@nova.io",
    role: "Frontend Intern",
    avatarColor: "oklch(0.55 0.22 295)",
    status: "active",
    productivity: 92,
    workHours: 6.4,
    breakHours: 0.7,
    currentApp: "VS Code",
    currentSite: "github.com",
    task: "Refactor onboarding flow",
    lastActive: "Just now",
    joinedDate: "May 12, 2025",
    timezone: "PST",
  },
  {
    id: "diego-ramos",
    name: "Diego Ramos",
    email: "diego.ramos@nova.io",
    role: "Backend Intern",
    avatarColor: "oklch(0.7 0.15 200)",
    status: "active",
    productivity: 88,
    workHours: 5.9,
    breakHours: 0.5,
    currentApp: "Terminal",
    currentSite: "stackoverflow.com",
    task: "Build invoices API endpoint",
    lastActive: "Just now",
    joinedDate: "Apr 28, 2025",
    timezone: "EST",
  },
  {
    id: "priya-nair",
    name: "Priya Nair",
    email: "priya.nair@nova.io",
    role: "Design Intern",
    avatarColor: "oklch(0.65 0.2 20)",
    status: "paused",
    productivity: 76,
    workHours: 4.2,
    breakHours: 1.3,
    currentApp: "Figma",
    currentSite: "dribbble.com",
    task: "Dashboard empty states",
    lastActive: "8 min ago",
    joinedDate: "May 02, 2025",
    timezone: "IST",
  },
  {
    id: "marcus-lee",
    name: "Marcus Lee",
    email: "marcus.lee@nova.io",
    role: "Data Intern",
    avatarColor: "oklch(0.68 0.16 150)",
    status: "active",
    productivity: 81,
    workHours: 6.1,
    breakHours: 0.6,
    currentApp: "Jupyter",
    currentSite: "kaggle.com",
    task: "Churn model evaluation",
    lastActive: "2 min ago",
    joinedDate: "Mar 18, 2025",
    timezone: "PST",
  },
  {
    id: "sofia-mancini",
    name: "Sofia Mancini",
    email: "sofia.mancini@nova.io",
    role: "Marketing Intern",
    avatarColor: "oklch(0.75 0.15 65)",
    status: "offline",
    productivity: 69,
    workHours: 3.4,
    breakHours: 0.9,
    currentApp: "Notion",
    currentSite: "youtube.com",
    task: "Q3 content calendar",
    lastActive: "1 hr ago",
    joinedDate: "May 20, 2025",
    timezone: "CET",
  },
  {
    id: "kenji-tanaka",
    name: "Kenji Tanaka",
    email: "kenji.tanaka@nova.io",
    role: "QA Intern",
    avatarColor: "oklch(0.6 0.12 260)",
    status: "active",
    productivity: 85,
    workHours: 5.5,
    breakHours: 0.8,
    currentApp: "Linear",
    currentSite: "jira.com",
    task: "Regression test suite",
    lastActive: "Just now",
    joinedDate: "Apr 11, 2025",
    timezone: "JST",
  },
  {
    id: "hannah-berg",
    name: "Hannah Berg",
    email: "hannah.berg@nova.io",
    role: "Frontend Intern",
    avatarColor: "oklch(0.62 0.18 330)",
    status: "paused",
    productivity: 73,
    workHours: 4.8,
    breakHours: 1.1,
    currentApp: "Chrome",
    currentSite: "tailwindcss.com",
    task: "Settings page polish",
    lastActive: "21 min ago",
    joinedDate: "May 06, 2025",
    timezone: "CET",
  },
  {
    id: "omar-farouk",
    name: "Omar Farouk",
    email: "omar.farouk@nova.io",
    role: "Backend Intern",
    avatarColor: "oklch(0.58 0.14 145)",
    status: "active",
    productivity: 90,
    workHours: 6.7,
    breakHours: 0.4,
    currentApp: "VS Code",
    currentSite: "vercel.com",
    task: "Rate limiting middleware",
    lastActive: "Just now",
    joinedDate: "Mar 30, 2025",
    timezone: "GMT",
  },
]

export const productivityTrend = [
  { day: "Mon", productivity: 78, hours: 41 },
  { day: "Tue", productivity: 82, hours: 44 },
  { day: "Wed", productivity: 85, hours: 46 },
  { day: "Thu", productivity: 80, hours: 43 },
  { day: "Fri", productivity: 88, hours: 48 },
  { day: "Sat", productivity: 71, hours: 22 },
  { day: "Sun", productivity: 64, hours: 12 },
]

export const appUsage: AppUsage[] = [
  { name: "VS Code", category: "productive", minutes: 1840 },
  { name: "Figma", category: "productive", minutes: 920 },
  { name: "Terminal", category: "productive", minutes: 760 },
  { name: "Notion", category: "neutral", minutes: 540 },
  { name: "Slack", category: "neutral", minutes: 480 },
  { name: "Chrome", category: "neutral", minutes: 1320 },
  { name: "Spotify", category: "distracting", minutes: 360 },
  { name: "YouTube", category: "distracting", minutes: 210 },
]

export const siteUsage: SiteUsage[] = [
  { domain: "github.com", category: "productive", minutes: 1280 },
  { domain: "stackoverflow.com", category: "productive", minutes: 640 },
  { domain: "vercel.com", category: "productive", minutes: 410 },
  { domain: "tailwindcss.com", category: "productive", minutes: 320 },
  { domain: "youtube.com", category: "distracting", minutes: 480 },
  { domain: "twitter.com", category: "distracting", minutes: 260 },
  { domain: "dribbble.com", category: "neutral", minutes: 300 },
  { domain: "reddit.com", category: "distracting", minutes: 180 },
]

export const recentActivity: ActivityEvent[] = [
  { id: "a1", internId: "amelia-cho", intern: "Amelia Cho", action: "Started tracking", detail: "Refactor onboarding flow", time: "Just now", type: "session" },
  { id: "a2", internId: "omar-farouk", intern: "Omar Farouk", action: "Switched app", detail: "Terminal → VS Code", time: "2 min ago", type: "app" },
  { id: "a3", internId: "marcus-lee", intern: "Marcus Lee", action: "Visited site", detail: "kaggle.com", time: "5 min ago", type: "site" },
  { id: "a4", internId: "priya-nair", intern: "Priya Nair", action: "Paused tracking", detail: "Break started", time: "8 min ago", type: "break" },
  { id: "a5", internId: "diego-ramos", intern: "Diego Ramos", action: "Completed task", detail: "Auth token rotation", time: "14 min ago", type: "task" },
  { id: "a6", internId: "kenji-tanaka", intern: "Kenji Tanaka", action: "Switched app", detail: "Jira → Linear", time: "19 min ago", type: "app" },
  { id: "a7", internId: "hannah-berg", intern: "Hannah Berg", action: "Paused tracking", detail: "Break started", time: "21 min ago", type: "break" },
  { id: "a8", internId: "sofia-mancini", intern: "Sofia Mancini", action: "Ended session", detail: "3h 24m logged", time: "1 hr ago", type: "session" },
]

export const tasks = [
  { id: "t1", title: "Refactor onboarding flow", project: "Web App", priority: "High", estimate: "4h", status: "In progress" },
  { id: "t2", title: "Build invoices API endpoint", project: "Billing", priority: "High", estimate: "6h", status: "In progress" },
  { id: "t3", title: "Dashboard empty states", project: "Design System", priority: "Medium", estimate: "3h", status: "Todo" },
  { id: "t4", title: "Churn model evaluation", project: "Data", priority: "Medium", estimate: "5h", status: "In progress" },
  { id: "t5", title: "Q3 content calendar", project: "Marketing", priority: "Low", estimate: "2h", status: "Todo" },
  { id: "t6", title: "Regression test suite", project: "QA", priority: "High", estimate: "8h", status: "In progress" },
]

// Screenshot gallery grouped by hour. Uses placeholder gradients via query string.
export interface Screenshot {
  id: string
  hour: string
  time: string
  app: string
  activity: number
}

export const screenshotHours = [
  {
    hour: "09:00 AM",
    shots: [
      { id: "s1", hour: "09:00", time: "09:04", app: "VS Code", activity: 94 },
      { id: "s2", hour: "09:00", time: "09:14", app: "VS Code", activity: 88 },
      { id: "s3", hour: "09:00", time: "09:24", app: "Chrome", activity: 71 },
      { id: "s4", hour: "09:00", time: "09:34", app: "Terminal", activity: 96 },
      { id: "s5", hour: "09:00", time: "09:44", app: "Slack", activity: 52 },
      { id: "s6", hour: "09:00", time: "09:54", app: "VS Code", activity: 90 },
    ] as Screenshot[],
  },
  {
    hour: "10:00 AM",
    shots: [
      { id: "s7", hour: "10:00", time: "10:04", app: "Figma", activity: 84 },
      { id: "s8", hour: "10:00", time: "10:14", app: "Figma", activity: 79 },
      { id: "s9", hour: "10:00", time: "10:24", app: "Chrome", activity: 63 },
      { id: "s10", hour: "10:00", time: "10:34", app: "Notion", activity: 58 },
      { id: "s11", hour: "10:00", time: "10:44", app: "VS Code", activity: 91 },
    ] as Screenshot[],
  },
  {
    hour: "11:00 AM",
    shots: [
      { id: "s12", hour: "11:00", time: "11:04", app: "VS Code", activity: 89 },
      { id: "s13", hour: "11:00", time: "11:14", app: "Terminal", activity: 93 },
      { id: "s14", hour: "11:00", time: "11:24", app: "YouTube", activity: 18 },
      { id: "s15", hour: "11:00", time: "11:34", app: "Chrome", activity: 66 },
    ] as Screenshot[],
  },
]

export const appUsageHistory = [
  { time: "09:00", app: "VS Code", site: "github.com", duration: "52 min", category: "productive" },
  { time: "10:00", app: "Figma", site: "figma.com", duration: "48 min", category: "productive" },
  { time: "11:00", app: "Chrome", site: "stackoverflow.com", duration: "31 min", category: "productive" },
  { time: "11:40", app: "YouTube", site: "youtube.com", duration: "12 min", category: "distracting" },
  { time: "12:00", app: "Slack", site: "slack.com", duration: "18 min", category: "neutral" },
  { time: "01:30", app: "Terminal", site: "vercel.com", duration: "44 min", category: "productive" },
  { time: "02:30", app: "Notion", site: "notion.so", duration: "26 min", category: "neutral" },
]

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function categoryColor(category: string) {
  switch (category) {
    case "productive":
      return "var(--color-chart-3)"
    case "neutral":
      return "var(--color-chart-2)"
    case "distracting":
      return "var(--color-chart-5)"
    default:
      return "var(--color-muted-foreground)"
  }
}
