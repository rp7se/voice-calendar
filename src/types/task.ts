export type TaskPriority = 'high' | 'medium' | 'low'

export type TaskStatus = 'pending' | 'completed'

export type TaskSchedulingStatus = 'unscheduled' | 'scheduled'

export type Task = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  deadlineDate?: string
  deadlineTime?: string
  estimatedDurationMinutes?: number
  categoryId?: string
  schedulingStatus: TaskSchedulingStatus
  scheduledEventId: string | null
  scheduledAt: string | null
  createdAt: string
  updatedAt: string
}

export type TaskInput = Omit<
  Task,
  | 'id'
  | 'schedulingStatus'
  | 'scheduledEventId'
  | 'scheduledAt'
  | 'createdAt'
  | 'updatedAt'
>
