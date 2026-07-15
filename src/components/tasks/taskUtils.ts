import type { Task, TaskPriority } from '../../types/task.ts'
import { formatDate } from '../../utils/date.ts'

export type TaskTab = 'today' | 'upcoming' | 'completed'

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
}

export function getTodayKey(date = new Date()): string {
  return formatDate(date)
}

export function filterTasksByCategory(
  tasks: Task[],
  categoryId: string | null,
): Task[] {
  if (!categoryId) {
    return tasks
  }
  return tasks.filter((task) => task.categoryId === categoryId)
}

export function filterTasksByTab(tasks: Task[], tab: TaskTab): Task[] {
  const todayKey = getTodayKey()

  if (tab === 'completed') {
    return tasks.filter((task) => task.status === 'completed')
  }

  const pendingTasks = tasks.filter((task) => task.status === 'pending')

  if (tab === 'today') {
    return pendingTasks.filter(
      (task) => task.deadlineDate !== undefined && task.deadlineDate <= todayKey,
    )
  }

  return pendingTasks.filter(
    (task) => !task.deadlineDate || task.deadlineDate > todayKey,
  )
}

export function sortTasks(tasks: Task[]): Task[] {
  const priorityWeight: Record<TaskPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  }

  return [...tasks].sort((a, b) => {
    const deadlineA = a.deadlineDate ?? '9999-12-31'
    const deadlineB = b.deadlineDate ?? '9999-12-31'
    const deadlineDiff = deadlineA.localeCompare(deadlineB)
    if (deadlineDiff !== 0) {
      return deadlineDiff
    }

    const priorityDiff = priorityWeight[a.priority] - priorityWeight[b.priority]
    if (priorityDiff !== 0) {
      return priorityDiff
    }

    return a.title.localeCompare(b.title)
  })
}

export function getTodayPendingTasks(tasks: Task[]): Task[] {
  return filterTasksByTab(tasks, 'today')
}

export function formatDuration(minutes?: number): string {
  if (!minutes) {
    return '未估时'
  }

  if (minutes < 60) {
    return `预计 ${minutes} 分钟`
  }

  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (restMinutes === 0) {
    return `预计 ${hours} 小时`
  }
  return `预计 ${hours} 小时 ${restMinutes} 分钟`
}

export function formatDeadline(task: Task): string {
  if (!task.deadlineDate) {
    return '无截止时间'
  }

  const todayKey = getTodayKey()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = formatDate(tomorrow)

  const time = task.deadlineTime ? ` ${task.deadlineTime}` : ''

  if (task.status !== 'completed' && task.deadlineDate < todayKey) {
    return `已逾期${time}`
  }
  if (task.deadlineDate === todayKey) {
    return `今天${time}`
  }
  if (task.deadlineDate === tomorrowKey) {
    return `明天${time}`
  }

  const [, month, day] = task.deadlineDate.split('-')
  return `${Number(month)} 月 ${Number(day)} 日${time}`
}

export function getTaskOverview(tasks: Task[]) {
  const todayKey = getTodayKey()
  const pending = tasks.filter((task) => task.status === 'pending')
  const completed = tasks.filter((task) => task.status === 'completed')
  const dueToday = pending.filter((task) => task.deadlineDate === todayKey)

  return {
    pendingCount: pending.length,
    dueTodayCount: dueToday.length,
    completedCount: completed.length,
  }
}

export function getTodayWorkloadMinutes(tasks: Task[]): number {
  return getTodayPendingTasks(tasks).reduce(
    (total, task) => total + (task.estimatedDurationMinutes ?? 0),
    0,
  )
}
