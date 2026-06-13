import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { tasks } from "@/data/mock"
import { Check, Clock, Folder, Play } from "lucide-react"

function priorityVariant(priority: string) {
  if (priority === "High") return "danger"
  if (priority === "Medium") return "warning"
  return "neutral"
}

export function TaskSelection() {
  const [activeTask, setActiveTask] = useState(tasks[0].id)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Select a task"
        description="Choose what you're working on so tracking is attributed correctly."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {tasks.map((task) => {
          const selected = task.id === activeTask
          return (
            <Card
              key={task.id}
              className={`cursor-pointer transition-all hover:border-primary/50 ${
                selected ? "border-primary ring-1 ring-primary/40" : ""
              }`}
              onClick={() => setActiveTask(task.id)}
            >
              <CardContent className="flex flex-col gap-4 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={priorityVariant(task.priority) as never}>{task.priority}</Badge>
                    <Badge variant="neutral">{task.status}</Badge>
                  </div>
                  {selected && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold text-foreground text-pretty">{task.title}</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Folder className="h-4 w-4" /> {task.project}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> {task.estimate}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Selected:{" "}
          <span className="font-medium text-foreground">
            {tasks.find((t) => t.id === activeTask)?.title}
          </span>
        </p>
        <Button>
          <Play className="h-4 w-4" /> Start tracking
        </Button>
      </div>
    </div>
  )
}
