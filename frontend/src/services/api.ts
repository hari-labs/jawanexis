export type Status = "active" | "paused" | "offline"

const BASE_URL = "http://localhost:5000"

export async function getUsers() {

    const response = await fetch(
        `${BASE_URL}/reports/user-summary`
    )

    return await response.json()

}


export async function getSessions() {

    const response = await fetch(`${BASE_URL}/sessions`)

    return await response.json()

}


export async function getApplications() {

    const response = await fetch(`${BASE_URL}/applications`)

    return await response.json()

}


export async function getWebsites() {

    const response = await fetch(`${BASE_URL}/websites`)

    return await response.json()

}


export async function getScreenshots() {

    const response = await fetch(
        `${BASE_URL}/reports/screenshots`
    )

    return await response.json()

}

export async function getRecentActivity() {

    const response = await fetch(
        `${BASE_URL}/reports/recent-activity`
    )

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


export async function getAppUsage() {

    const response = await fetch(
        `${BASE_URL}/reports/app-usage`
    )

    return await response.json()

}


export async function getSiteUsage() {

    const response = await fetch(
        `${BASE_URL}/reports/site-usage`
    )

    return await response.json()

}