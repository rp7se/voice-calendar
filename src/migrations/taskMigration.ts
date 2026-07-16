import { createTask, getTasks } from '../api/taskApi.ts'
import type { Task, TaskInput, TaskPriority, TaskStatus } from '../types/task.ts'
import { LEGACY_TASK_STORAGE_KEY } from '../utils/taskStorage.ts'

export const TASK_MIGRATION_MARKER_KEY = 'voice-calendar:task-migration:v1'

const TASK_STATUSES: TaskStatus[] = ['pending', 'completed']
const TASK_PRIORITIES: TaskPriority[] = ['high', 'medium', 'low']

type TaskMigrationMarker = {
  version: 1
  completed: true
  completedAt: string
}

type LegacyTask = {
  id?: string
  input: TaskInput
}

type LegacyReadResult = {
  tasks: LegacyTask[]
  invalid: number
  readFailed: boolean
}

export type TaskMigrationResult = {
  migrated: number
  skipped: number
  failed: number
  completed: boolean
  alreadyCompleted: boolean
  legacyCount: number
  backendCount: number
  tasks: Task[]
}

export class TaskMigrationError extends Error {
  readonly result: TaskMigrationResult

  constructor(message: string, result: TaskMigrationResult) {
    super(message)
    this.name = 'TaskMigrationError'
    this.result = result
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && TASK_STATUSES.includes(value as TaskStatus)
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && TASK_PRIORITIES.includes(value as TaskPriority)
}

function optionalNonEmptyString(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  return typeof value === 'string' && value.trim() ? value : null
}

function parseLegacyTask(value: unknown): LegacyTask | null {
  if (!isRecord(value)) {
    return null
  }

  const title = typeof value.title === 'string' ? value.title.trim() : ''
  if (!title || !isTaskStatus(value.status) || !isTaskPriority(value.priority)) {
    return null
  }

  const id = optionalNonEmptyString(value.id)
  const deadlineDate = optionalNonEmptyString(value.deadlineDate)
  const deadlineTime = optionalNonEmptyString(value.deadlineTime)
  const categoryId = optionalNonEmptyString(value.categoryId)
  if (id === null || deadlineDate === null || deadlineTime === null || categoryId === null) {
    return null
  }
  if (deadlineTime && !deadlineDate) {
    return null
  }

  const duration = value.estimatedDurationMinutes
  if (
    duration !== undefined &&
    duration !== null &&
    (typeof duration !== 'number' || !Number.isInteger(duration) || duration <= 0)
  ) {
    return null
  }

  return {
    id,
    input: {
      title,
      status: value.status,
      priority: value.priority,
      deadlineDate,
      deadlineTime,
      estimatedDurationMinutes: typeof duration === 'number' ? duration : undefined,
      categoryId,
    },
  }
}

function readLegacyTasks(): LegacyReadResult {
  let raw: string | null
  try {
    raw = localStorage.getItem(LEGACY_TASK_STORAGE_KEY)
  } catch {
    return { tasks: [], invalid: 0, readFailed: true }
  }

  if (raw === null || !raw.trim()) {
    return { tasks: [], invalid: 0, readFailed: false }
  }

  let value: unknown
  try {
    value = JSON.parse(raw) as unknown
  } catch {
    return { tasks: [], invalid: 1, readFailed: true }
  }
  if (!Array.isArray(value)) {
    return { tasks: [], invalid: 1, readFailed: true }
  }

  const tasks: LegacyTask[] = []
  let invalid = 0
  for (const item of value) {
    const task = parseLegacyTask(item)
    if (task) {
      tasks.push(task)
    } else {
      invalid += 1
    }
  }
  return { tasks, invalid, readFailed: false }
}

function isMigrationCompleted(): boolean {
  try {
    const raw = localStorage.getItem(TASK_MIGRATION_MARKER_KEY)
    if (!raw) {
      return false
    }
    const value: unknown = JSON.parse(raw)
    return isRecord(value) && value.version === 1 && value.completed === true &&
      typeof value.completedAt === 'string'
  } catch {
    return false
  }
}

function writeMigrationMarker(): boolean {
  const marker: TaskMigrationMarker = {
    version: 1,
    completed: true,
    completedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(TASK_MIGRATION_MARKER_KEY, JSON.stringify(marker))
    return isMigrationCompleted()
  } catch {
    return false
  }
}

function fingerprint(input: TaskInput): string {
  return JSON.stringify([
    input.title.trim(),
    input.status,
    input.priority,
    input.deadlineDate ?? null,
    input.deadlineTime ?? null,
    input.estimatedDurationMinutes ?? null,
    input.categoryId ?? null,
  ])
}

function matchesBackendTask(legacy: LegacyTask, backendTasks: readonly Task[]): boolean {
  if (legacy.id) {
    return backendTasks.some((task) => task.id === legacy.id)
  }
  const key = fingerprint(legacy.input)
  return backendTasks.some((task) => fingerprint(task) === key)
}

function incompleteResult(
  legacyCount: number,
  failed: number,
  tasks: Task[] = [],
): TaskMigrationResult {
  return {
    migrated: 0,
    skipped: 0,
    failed,
    completed: false,
    alreadyCompleted: false,
    legacyCount,
    backendCount: tasks.length,
    tasks,
  }
}

async function runLegacyTaskMigration(): Promise<TaskMigrationResult> {
  if (isMigrationCompleted()) {
    const tasks = await getTasks()
    return {
      migrated: 0,
      skipped: 0,
      failed: 0,
      completed: true,
      alreadyCompleted: true,
      legacyCount: 0,
      backendCount: tasks.length,
      tasks,
    }
  }

  const legacy = readLegacyTasks()
  const legacyCount = legacy.tasks.length + legacy.invalid
  if (legacy.readFailed) {
    throw new TaskMigrationError(
      '旧任务数据无法安全读取，迁移尚未完成。旧数据已保留。',
      incompleteResult(legacyCount, Math.max(legacy.invalid, 1)),
    )
  }

  let backendTasks: Task[]
  try {
    backendTasks = await getTasks()
  } catch {
    throw new TaskMigrationError(
      '暂时无法连接任务服务，旧任务尚未迁移。',
      incompleteResult(legacyCount, legacyCount),
    )
  }

  let migrated = 0
  let skipped = 0
  for (const task of legacy.tasks) {
    if (matchesBackendTask(task, backendTasks)) {
      skipped += 1
      continue
    }

    try {
      const created = await createTask(task.input, task.id)
      backendTasks = [...backendTasks, created]
      migrated += 1
    } catch {
      // A final authoritative GET verifies whether the write reached SQLite.
    }
  }

  try {
    backendTasks = await getTasks()
  } catch {
    throw new TaskMigrationError(
      '旧任务迁移后无法完成验证，迁移标记尚未写入。旧数据已保留。',
      { ...incompleteResult(legacyCount, legacyCount, backendTasks), migrated, skipped },
    )
  }

  const missing = legacy.tasks.filter((task) => !matchesBackendTask(task, backendTasks)).length
  const failed = legacy.invalid + missing
  if (failed > 0) {
    throw new TaskMigrationError(
      '旧任务迁移暂未完成，请确认任务服务正常运行。旧数据已保留。',
      {
        migrated,
        skipped,
        failed,
        completed: false,
        alreadyCompleted: false,
        legacyCount,
        backendCount: backendTasks.length,
        tasks: backendTasks,
      },
    )
  }

  if (!writeMigrationMarker()) {
    throw new TaskMigrationError(
      '旧任务已写入任务服务，但无法保存迁移完成标记。旧数据已保留。',
      {
        migrated,
        skipped,
        failed: 1,
        completed: false,
        alreadyCompleted: false,
        legacyCount,
        backendCount: backendTasks.length,
        tasks: backendTasks,
      },
    )
  }

  return {
    migrated,
    skipped,
    failed: 0,
    completed: true,
    alreadyCompleted: false,
    legacyCount,
    backendCount: backendTasks.length,
    tasks: backendTasks,
  }
}

let activeMigration: Promise<TaskMigrationResult> | null = null

export function migrateLegacyTasks(): Promise<TaskMigrationResult> {
  if (activeMigration) {
    return activeMigration
  }

  const migration = runLegacyTaskMigration()
  const sharedMigration = migration.then(
    (result) => {
      if (activeMigration === sharedMigration) {
        activeMigration = null
      }
      return result
    },
    (error: unknown) => {
      if (activeMigration === sharedMigration) {
        activeMigration = null
      }
      throw error
    },
  )
  activeMigration = sharedMigration
  return sharedMigration
}
