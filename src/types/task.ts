export type TaskPriority = 'high' | 'medium' | 'low'

export type TaskStatus = 'pending' | 'completed'

export type Task = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  deadlineDate?: string
  deadlineTime?: string
  estimatedDurationMinutes?: number
  categoryId?: string
  createdAt: string
  updatedAt: string
}

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
