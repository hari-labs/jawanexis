import { Routes, Route, Navigate } from "react-router-dom"
import { AppLayout } from "@/components/app-layout"
import { Login } from "@/pages/login"
import { AdminDashboard } from "@/pages/admin/dashboard"
import { InternManagement } from "@/pages/admin/intern-management"
import { InviteIntern } from "@/pages/admin/invite-intern"
import { InternDetails } from "@/pages/admin/intern-details"
import { Screenshots } from "@/pages/admin/screenshots"
import { Reports } from "@/pages/admin/reports"
import { AdminSettings } from "@/pages/admin/settings"
import { InternDashboard } from "@/pages/intern/dashboard"
import { TaskSelection } from "@/pages/intern/tasks"
import { ActivityPage } from "@/pages/intern/activity"
import { InternSettings } from "@/pages/intern/settings"

// New page imports
import { Activate } from "@/pages/activate"
import { UsersList } from "@/pages/admin/users"
import { Invitations } from "@/pages/admin/invitations"
import { ProjectsPage } from "@/pages/projects"
import { TeamLeadDashboard } from "@/pages/team_lead/dashboard"
import { TeamMembers } from "@/pages/team_lead/members"
import { TeamLeadTasks } from "@/pages/team_lead/tasks"
import { TeamAnalytics } from "@/pages/team_lead/analytics"
import { TeamScreenshots } from "@/pages/team_lead/screenshots"
import { TeamOverview } from "@/pages/admin/teams"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login role="admin" />} />
      <Route path="/login/intern" element={<Login role="intern" />} />
      <Route path="/activate" element={<Activate />} />

      {/* Admin routes */}
      <Route element={<AppLayout role="admin" />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UsersList />} />
        <Route path="/admin/invitations" element={<Invitations />} />
        <Route path="/admin/projects" element={<ProjectsPage />} />
        <Route path="/admin/teams" element={<Navigate to="/admin/projects" replace />} />
        <Route path="/admin/analytics" element={<Reports />} />
        <Route path="/admin/screenshots" element={<Screenshots />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/interns" element={<InternManagement />} />
        <Route path="/admin/interns/:id" element={<InternDetails />} />
        <Route path="/admin/interns/invite" element={<InviteIntern />} />
      </Route>

      {/* Team Lead routes */}
      <Route element={<AppLayout role="team_lead" />}>
        <Route path="/team-lead" element={<TeamLeadDashboard />} />
        <Route path="/team-lead/activity" element={<ActivityPage />} />
        <Route path="/team-lead/projects" element={<ProjectsPage />} />
        <Route path="/team-lead/members" element={<Navigate to="/team-lead/projects" replace />} />
        <Route path="/team-lead/tasks" element={<Navigate to="/team-lead/projects" replace />} />
        <Route path="/team-lead/analytics" element={<TeamAnalytics />} />
        <Route path="/team-lead/screenshots" element={<TeamScreenshots />} />
      </Route>

      {/* Intern routes */}
      <Route element={<AppLayout role="intern" />}>
        <Route path="/intern" element={<InternDashboard />} />
        <Route path="/intern/tasks" element={<Navigate to="/intern/projects" replace />} />
        <Route path="/intern/activity" element={<ActivityPage />} />
        <Route path="/intern/projects" element={<ProjectsPage />} />
        <Route path="/intern/screenshots" element={<TeamScreenshots />} />
        <Route path="/intern/settings" element={<InternSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
