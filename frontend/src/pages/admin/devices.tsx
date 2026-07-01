import { useState, useEffect } from "react"
import { Monitor, Cpu, Clock, HardDrive, CheckCircle2, User, UserX } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getUserId, authFetch, BASE_URL } from "@/services/api"

interface Device {
  _id: string
  device_uuid: string
  hostname: string
  os_version: string
  status: "pending" | "approved"
  assigned_user_id: string | null
  assigned_user_email?: string
  assigned_user_name?: string
  registered_at: string
  last_seen_at: string
}

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDevices()
    fetchUsers()
  }, [])

  const fetchDevices = async () => {
    try {
      const response = await fetch(`${BASE_URL}/monitoring/devices`, {
        headers: { "X-User-Id": getUserId() },
      })
      if (!response.ok) throw new Error("Failed to fetch devices")
      const data = await response.json()
      setDevices(data.devices || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${BASE_URL}/users/`, {
        headers: { "X-User-Id": localStorage.getItem("id") || "" },
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error("Failed to fetch users", err)
    }
  }

  const assignDevice = async (deviceUuid: string, userId: string | null) => {
    try {
      const response = await fetch(`${BASE_URL}/monitoring/devices/${deviceUuid}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": localStorage.getItem("user_id") || "",
        },
        body: JSON.stringify({ user_id: userId }),
      })
      if (!response.ok) throw new Error("Failed to assign device")
      fetchDevices()
    } catch (err) {
      console.error(err)
      alert("Failed to assign device")
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <PageHeader
        title="Device Management"
        description="Manage and assign desktop agents to employees."
      />
      
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {devices.map((device) => (
          <Card key={device._id} className="relative overflow-hidden transition-all hover:shadow-md">
            <div className={`absolute top-0 left-0 h-1 w-full ${device.status === 'approved' ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-muted-foreground" />
                  {device.hostname}
                </CardTitle>
                <Badge variant={device.status === 'approved' ? 'default' : 'warning'} className={device.status === 'approved' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'}>
                  {device.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    <span className="truncate" title={device.device_uuid}>{device.device_uuid.substring(0, 8)}...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    <span className="truncate">{device.os_version}</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <Clock className="h-4 w-4" />
                    Last seen: {new Date(device.last_seen_at).toLocaleString()}
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2 font-medium">
                    {device.assigned_user_id ? (
                      <><User className="h-4 w-4 text-primary" /> Assigned To</>
                    ) : (
                      <><UserX className="h-4 w-4 text-muted-foreground" /> Unassigned</>
                    )}
                  </div>
                  
                  {device.assigned_user_id ? (
                    <div className="text-sm">
                      <p className="font-semibold">{device.assigned_user_name || "Unknown User"}</p>
                      <p className="text-muted-foreground">{device.assigned_user_email}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-3 border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={() => assignDevice(device.device_uuid, null)}
                      >
                        Unassign Device
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select 
                        className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        onChange={(e) => assignDevice(device.device_uuid, e.target.value)}
                        defaultValue=""
                      >
                        <option value="" disabled>Select a user to assign...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {devices.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Monitor className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">No devices registered</p>
            <p className="text-sm">Start a desktop agent to see it appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
