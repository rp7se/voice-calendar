import type { Task, TaskInput } from '../types/task.ts'

const TASK_STORAGE_KEY = 'voice-calendar:tasks'

function createId(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

function readTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASK_STORAGE_KEY)
    if (!raw || raw.trim() === '') {
      return []
    }
    return JSON.parse(raw) as Task[]
  } catch {
    return []
  }
}

function writeTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks))
  } catch {
    // Keep the UI usable if localStorage is unavailable or full.
  }
}

export function getTasks(): Task[] {
  return readTasks()
}

export function addTask(input: TaskInput): Task {
  const timestamp = nowIso()
  const task: Task = {
    ...input,
    id: createId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const tasks = getTasks()
  tasks.push(task)
  writeTasks(tasks)
  return task
}

export function updateTask(id: string, partialTask: Partial<TaskInput>): Task | null {
  const tasks = getTasks()
  const index = tasks.findIndex((task) => task.id === id)
  if (index === -1) {
    return null
  }

  const updated: Task = {
    ...tasks[index],
    ...partialTask,
    id: tasks[index].id,
    createdAt: tasks[index].createdAt,
    updatedAt: nowIso(),
  }

  tasks[index] = updated
  writeTasks(tasks)
  return updated
}

export function deleteTask(id: string): boolean {
  const tasks = getTasks()
  const nextTasks = tasks.filter((task) => task.id !== id)
  if (nextTasks.length === tasks.length) {
    return false
  }
  writeTasks(nextTasks)
  return true
}
