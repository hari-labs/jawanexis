export type Status = "active" | "paused" | "offline"

export const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000"

function getUserId() {
    const storedUserStr = localStorage.getItem("user")
    if (storedUserStr) {
        try {
            const parsed = JSON.parse(storedUserStr)
            return parsed?.id || ""
        } catch (e) {}
    }
    return ""
}

async function authFetch(url: string, options: RequestInit = {}) {
    const userId = getUserId()
    const headers = { ...(options.headers || {}) } as Record<string, string>
    if (userId) {
        headers["X-User-Id"] = userId
    }
    return fetch(url, { ...options, headers })
}

export async function getProjects() {
    const response = await authFetch(`${BASE_URL}/projects/`)
    return await response.json()
}

export async function getUsers() {
    const response = await authFetch(
        `${BASE_URL}/reports/user-summary`
    )
    return await response.json()
}

export async function getSessions() {
    const response = await authFetch(`${BASE_URL}/sessions`)
    return await response.json()
}

export async function getApplications() {
    const response = await authFetch(`${BASE_URL}/applications`)
    return await response.json()
}

export async function getWebsites() {
    const response = await authFetch(`${BASE_URL}/websites`)
    return await response.json()
}

export async function getScreenshots(employeeId?: string, date?: string) {
    const params = new URLSearchParams()
    if (employeeId) params.append("employee_id", employeeId)
    if (date) params.append("date", date)
    
    const url = params.toString() ? `${BASE_URL}/reports/screenshots?${params.toString()}` : `${BASE_URL}/reports/screenshots`
    const response = await authFetch(url)
    return await response.json()
}

export async function getRecentActivity(employeeId?: string) {
    const url = employeeId ? `${BASE_URL}/reports/recent-activity?employee_id=${employeeId}` : `${BASE_URL}/reports/recent-activity`
    const response = await authFetch(url)
    return await response.json()
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

export async function getAppUsage(employeeId?: string, options?: RequestInit) {
    const url = employeeId ? `${BASE_URL}/reports/app-usage?employee_id=${employeeId}` : `${BASE_URL}/reports/app-usage`
    const response = await authFetch(url, options)
    return await response.json()
}

export async function getSiteUsage(employeeId?: string, options?: RequestInit) {
    const url = employeeId ? `${BASE_URL}/reports/site-usage?employee_id=${employeeId}` : `${BASE_URL}/reports/site-usage`
    const response = await authFetch(url, options)
    return await response.json()
}

export async function getProductivityTrend(days = 7, employeeId?: string) {
    const params = new URLSearchParams()
    params.append("days", String(days))
    if (employeeId) params.append("employee_id", employeeId)
    const response = await authFetch(`${BASE_URL}/reports/productivity-trend?${params.toString()}`)
    return await response.json()
}

export async function getWorkTimeTrend(days = 7, employeeId?: string) {
    const params = new URLSearchParams()
    params.append("days", String(days))
    if (employeeId) params.append("employee_id", employeeId)
    const response = await authFetch(`${BASE_URL}/reports/work-time-trend?${params.toString()}`)
    return await response.json()
}

export async function getPublicStats() {
    const response = await fetch(`${BASE_URL}/reports/public-stats`)
    return await response.json()
}

export async function getInternSummary(id: string, sessionId?: string, options?: RequestInit) {
    const url = sessionId && sessionId !== "all"
        ? `${BASE_URL}/reports/intern-summary/${id}?session_id=${sessionId}`
        : `${BASE_URL}/reports/intern-summary/${id}`
    const response = await authFetch(url, options)
    return await response.json()
}

export async function login(email: string, password?: string) {
    const response = await authFetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })
    return await response.json()
}

export async function createSession(sessionData: any) {
    const response = await authFetch(`${BASE_URL}/sessions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData)
    })
    return await response.json()
}

export async function createApplication(appData: any) {
    const response = await authFetch(`${BASE_URL}/applications/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appData)
    })
    return await response.json()
}

export async function createWebsite(siteData: any) {
    const response = await authFetch(`${BASE_URL}/websites/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siteData)
    })
    return await response.json()
}

export async function createScreenshot(screenshotData: any) {
    const response = await authFetch(`${BASE_URL}/screenshots/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(screenshotData)
    })
    return await response.json()
}

export async function getActivities() {
    const response = await authFetch(`${BASE_URL}/activities/`)
    return await response.json()
}

export async function createActivity(activityData: any) {
    const response = await authFetch(`${BASE_URL}/activities/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityData)
    })
    return await response.json()
}

export async function getInvitations() {
    const response = await authFetch(`${BASE_URL}/invitations/`)
    return await response.json()
}

export async function createInvitation(email: string, role: string) {
    const response = await authFetch(`${BASE_URL}/invitations/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role })
    })
    return await response.json()
}

export async function resendInvitation(token: string) {
    const response = await authFetch(`${BASE_URL}/invitations/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
    })
    return await response.json()
}

export async function getNotifications() {
    const response = await authFetch(`${BASE_URL}/notifications/`)
    return await response.json()
}

export async function createNotification(notificationData: any) {
    const response = await authFetch(`${BASE_URL}/notifications/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationData)
    })
    return await response.json()
}

export async function getAuditLogs() {
    const response = await authFetch(`${BASE_URL}/audit_logs/`)
    return await response.json()
}

export async function createAuditLog(logData: any) {
    const response = await authFetch(`${BASE_URL}/audit_logs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logData)
    })
    return await response.json()
}

export async function getUserTasks(userId: string) {
    const response = await authFetch(`${BASE_URL}/tasks/user/${userId}`)
    return await response.json()
}

export async function createTask(taskData: any) {
    const response = await authFetch(`${BASE_URL}/tasks/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData)
    })
    return await response.json()
}

export async function updateTask(taskId: string, taskData: any) {
    const response = await authFetch(`${BASE_URL}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData)
    })
    return await response.json()
}

export async function validateInvitation(token: string) {
    const response = await authFetch(`${BASE_URL}/invitations/validate/${token}`)
    return await response.json()
}

export async function activateInvitation(token: string, name: string, password: string) {
    const response = await authFetch(`${BASE_URL}/invitations/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password })
    })
    return await response.json()
}

export async function toggleUserActive(userId: string) {
    const response = await authFetch(`${BASE_URL}/users/${userId}/toggle-active`, {
        method: "POST"
    })
    return await response.json()
}

export async function changeUserRole(userId: string, role: string) {
    const response = await authFetch(`${BASE_URL}/users/${userId}/change-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
    })
    return await response.json()
}

export async function deleteUser(userId: string) {
    const response = await authFetch(`${BASE_URL}/users/${userId}`, {
        method: "DELETE"
    })
    return await response.json()
}

export async function logoutUser() {
    const response = await authFetch(`${BASE_URL}/auth/logout`, {
        method: "POST"
    })
    return await response.json()
}

export async function getAssignedProjects(userId: string) {
    const response = await authFetch(`${BASE_URL}/projects/assigned/${userId}`)
    return await response.json()
}

export async function assignProjectMember(projectId: string, userId: string, role: string) {
    const response = await authFetch(`${BASE_URL}/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role })
    })
    return await response.json()
}

export async function removeProjectMember(projectId: string, userId: string) {
    const response = await authFetch(`${BASE_URL}/projects/${projectId}/members/${userId}`, {
        method: "DELETE"
    })
    return await response.json()
}

export async function uploadTaskEvidence(taskId: string, file: File, notes: string, uploadedBy?: string) {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("notes", notes)
    if (uploadedBy) {
        formData.append("uploaded_by", uploadedBy)
    }
    
    const response = await authFetch(`${BASE_URL}/tasks/${taskId}/evidence`, {
        method: "POST",
        body: formData
    })
    return await response.json()
}

export async function reviewTaskEvidence(taskId: string, status: "approved" | "rejected", reviewComments: string, reviewedBy: string) {
    const response = await authFetch(`${BASE_URL}/tasks/${taskId}/evidence/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, review_comments: reviewComments, reviewed_by: reviewedBy })
    })
    return await response.json()
}

export async function deleteTask(taskId: string) {
    const response = await authFetch(`${BASE_URL}/tasks/${taskId}`, {
        method: "DELETE"
    })
    return await response.json()
}

export async function getProjectEvidence(projectId: string) {
    const response = await authFetch(`${BASE_URL}/tasks/evidence/project/${projectId}`)
    return await response.json()
}

export async function getTeamOverview() {
    const response = await authFetch(`${BASE_URL}/teams/overview`)
    return await response.json()
}

export async function getAllEvidence(userId?: string) {
    const url = userId ? `${BASE_URL}/tasks/evidence?user_id=${userId}` : `${BASE_URL}/tasks/evidence`
    const response = await authFetch(url)
    return await response.json()
}

export async function getAllTasks() {
    const response = await authFetch(`${BASE_URL}/tasks/`)
    return await response.json()
}

export async function getProjectTasks(projectId: string) {
    const response = await authFetch(`${BASE_URL}/tasks/project/${projectId}`)
    return await response.json()
}

export async function archiveProject(projectId: string) {
    const response = await authFetch(`${BASE_URL}/projects/${projectId}/archive`, {
        method: "POST"
    })
    return await response.json()
}

export async function updateProject(projectId: string, projectData: any) {
    const response = await authFetch(`${BASE_URL}/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData)
    })
    return await response.json()
}

export async function createProject(projectData: any) {
    const response = await authFetch(`${BASE_URL}/projects/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData)
    })
    return await response.json()
}

export async function deleteProject(projectId: string) {
    const response = await authFetch(`${BASE_URL}/projects/${projectId}`, {
        method: "DELETE"
    })
    return await response.json()
}

export async function getMonitoringStatus(userId: string) {
    const response = await authFetch(`${BASE_URL}/monitoring/status/${userId}`)
    return await response.json()
}

export async function getAllMonitoringStatus() {
    const response = await authFetch(`${BASE_URL}/monitoring/status`)
    return await response.json()
}

export async function sendMonitoringCommand(userId: string, command: "START" | "PAUSE" | "RESUME" | "STOP") {
    const response = await authFetch(`${BASE_URL}/monitoring/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, command })
    })
    return await response.json()
}

export async function getTeamLeadAnalytics(leadId: string) {
    const response = await authFetch(`${BASE_URL}/reports/team-lead-analytics/${leadId}`)
    return await response.json()
}

export async function getDashboardData(userId: string, role: string, options?: RequestInit) {
    const response = await authFetch(`${BASE_URL}/reports/dashboard-data?user_id=${userId}&role=${role}`, options)
    return await response.json()
}