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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login role="admin" />} />
      <Route path="/login/intern" element={<Login role="intern" />} />

      <Route element={<AppLayout role="admin" />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/interns" element={<InternManagement />} />
        <Route path="/admin/interns/invite" element={<InviteIntern />} />
        <Route path="/admin/interns/:id" element={<InternDetails />} />
        <Route path="/admin/screenshots" element={<Screenshots />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Route>

      <Route element={<AppLayout role="intern" />}>
        <Route path="/intern" element={<InternDashboard />} />
        <Route path="/intern/tasks" element={<TaskSelection />} />
        <Route path="/intern/activity" element={<ActivityPage />} />
        <Route path="/intern/settings" element={<InternSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
