import { ApiError } from './eventApi.ts'
import type {
  Task,
  TaskInput,
  TaskPriority,
  TaskSchedulingStatus,
  TaskStatus,
} from '../types/task.ts'

const TASK_STATUSES: TaskStatus[] = ['pending', 'completed']
const TASK_PRIORITIES: TaskPriority[] = ['high', 'medium', 'low']
const TASK_SCHEDULING_STATUSES: TaskSchedulingStatus[] = ['unscheduled', 'scheduled']
const CONFIGURED_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
const API_BASE_URL = CONFIGURED_API_BASE_URL.replace(/\/$/, '')
const TASKS_URL = `${API_BASE_URL}/tasks`

export type BackendTaskDto = Task

export type TaskWriteRequest = {
  id?: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  deadlineDate?: string
  deadlineTime?: string
  estimatedDurationMinutes?: number
  categoryId?: string
}

type ApiErrorBody = {
  error?: unknown
  message?: unknown
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

function isTaskSchedulingStatus(value: unknown): value is TaskSchedulingStatus {
  return (
    typeof value === 'string' &&
    TASK_SCHEDULING_STATUSES.includes(value as TaskSchedulingStatus)
  )
}

function parseBackendTask(value: unknown): BackendTaskDto {
  if (!isRecord(value)) {
    throw new ApiError(502, '任务服务返回了无法识别的数据。', 'invalid_response')
  }

  const requiredStrings = ['id', 'title', 'createdAt', 'updatedAt'] as const
  if (
    requiredStrings.some((field) => typeof value[field] !== 'string') ||
    !isTaskStatus(value.status) ||
    !isTaskPriority(value.priority) ||
    !isTaskSchedulingStatus(value.schedulingStatus)
  ) {
    throw new ApiError(502, '任务服务返回了不完整的数据。', 'invalid_response')
  }

  const optionalStrings = ['deadlineDate', 'deadlineTime', 'categoryId'] as const
  if (optionalStrings.some((field) => value[field] !== undefined && typeof value[field] !== 'string')) {
    throw new ApiError(502, '任务服务返回了无效的可选字段。', 'invalid_response')
  }
  if (
    value.estimatedDurationMinutes !== undefined &&
    (typeof value.estimatedDurationMinutes !== 'number' ||
      !Number.isInteger(value.estimatedDurationMinutes) ||
      value.estimatedDurationMinutes <= 0)
  ) {
    throw new ApiError(502, '任务服务返回了无效的预计耗时。', 'invalid_response')
  }
  if (
    (value.scheduledEventId !== null && typeof value.scheduledEventId !== 'string') ||
    (value.scheduledAt !== null && typeof value.scheduledAt !== 'string')
  ) {
    throw new ApiError(502, '任务服务返回了无效的排程关联。', 'invalid_response')
  }
  if (
    (value.schedulingStatus === 'scheduled' &&
      (typeof value.scheduledEventId !== 'string' || typeof value.scheduledAt !== 'string')) ||
    (value.schedulingStatus === 'unscheduled' &&
      (value.scheduledEventId !== null || value.scheduledAt !== null))
  ) {
    throw new ApiError(502, '任务服务返回了不一致的排程状态。', 'invalid_response')
  }

  return {
    id: value.id as string,
    title: value.title as string,
    status: value.status,
    priority: value.priority,
    deadlineDate: value.deadlineDate as string | undefined,
    deadlineTime: value.deadlineTime as string | undefined,
    estimatedDurationMinutes: value.estimatedDurationMinutes as number | undefined,
    categoryId: value.categoryId as string | undefined,
    schedulingStatus: value.schedulingStatus,
    scheduledEventId: value.scheduledEventId,
    scheduledAt: value.scheduledAt,
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
  }
}

export function toTaskWriteRequest(input: TaskInput, id?: string): TaskWriteRequest {
  return {
    ...(id ? { id } : {}),
    title: input.title,
    status: input.status,
    priority: input.priority,
    deadlineDate: input.deadlineDate,
    deadlineTime: input.deadlineTime,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    categoryId: input.categoryId,
  }
}

async function readError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | null
  try {
    const value: unknown = await response.json()
    body = isRecord(value) ? value : null
  } catch {
    body = null
  }

  const message =
    typeof body?.message === 'string' && body.message.trim()
      ? body.message
      : `任务请求失败（HTTP ${response.status}）。`
  const code = typeof body?.error === 'string' ? body.error : undefined
  return new ApiError(response.status, message, code)
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(0, '暂时无法连接任务服务。', 'network_error')
  }

  if (!response.ok) {
    throw await readError(response)
  }
  if (response.status === 204) {
    return null
  }

  try {
    return await response.json()
  } catch {
    throw new ApiError(502, '任务服务返回了无效 JSON。', 'invalid_response')
  }
}

export async function getTasks(): Promise<Task[]> {
  const value = await requestJson(TASKS_URL)
  if (!Array.isArray(value)) {
    throw new ApiError(502, '任务服务没有返回列表。', 'invalid_response')
  }
  return value.map(parseBackendTask)
}

export async function getTaskById(id: string): Promise<Task> {
  return parseBackendTask(await requestJson(`${TASKS_URL}/${encodeURIComponent(id)}`))
}

export async function createTask(input: TaskInput, legacyId?: string): Promise<Task> {
  return parseBackendTask(await requestJson(TASKS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toTaskWriteRequest(input, legacyId)),
  }))
}

export async function updateTask(id: string, input: TaskInput): Promise<Task> {
  return parseBackendTask(await requestJson(`${TASKS_URL}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toTaskWriteRequest(input)),
  }))
}

export async function linkTaskScheduling(id: string, eventId: string): Promise<Task> {
  return parseBackendTask(await requestJson(
    `${TASKS_URL}/${encodeURIComponent(id)}/scheduling`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    },
  ))
}

export async function deleteTask(id: string): Promise<void> {
  await requestJson(`${TASKS_URL}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
