import { ApiError } from './eventApi.ts'
import type { Task, TaskPriority, TaskStatus } from '../types/task.ts'

const CONFIGURED_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
const API_BASE_URL = CONFIGURED_API_BASE_URL.replace(/\/$/, '')
const SCHEDULING_PREVIEW_URL = `${API_BASE_URL}/scheduling/preview`

export type SchedulingTaskDto = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  deadlineDate?: string
  deadlineTime?: string
  estimatedDurationMinutes?: number
}

export type SchedulingPreviewRequest = {
  date: string
  range: {
    start: string
    end: string
  }
  tasks: SchedulingTaskDto[]
}

export type ScheduledTaskDto = {
  taskId: string
  title: string
  start: string
  end: string
  durationMinutes: number
}

export type UnscheduledTaskDto = {
  taskId: string
  title: string
  reason: string
}

export type SchedulingPreviewResponse = {
  date: string
  range: {
    start: string
    end: string
  }
  strategy: string
  scheduled: ScheduledTaskDto[]
  unscheduled: UnscheduledTaskDto[]
  summary: {
    totalTasks: number
    scheduledTasks: number
    unscheduledTasks: number
    skippedCompletedTasks: number
    scheduledMinutes: number
  }
}

type ApiErrorBody = {
  error?: unknown
  message?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function parseScheduledTask(value: unknown): ScheduledTaskDto {
  if (
    !isRecord(value) ||
    typeof value.taskId !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.start !== 'string' ||
    typeof value.end !== 'string' ||
    !isNonNegativeInteger(value.durationMinutes)
  ) {
    throw new ApiError(502, '排程服务返回了无效的已安排任务。', 'invalid_response')
  }

  return {
    taskId: value.taskId,
    title: value.title,
    start: value.start,
    end: value.end,
    durationMinutes: value.durationMinutes,
  }
}

function parseUnscheduledTask(value: unknown): UnscheduledTaskDto {
  if (
    !isRecord(value) ||
    typeof value.taskId !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.reason !== 'string'
  ) {
    throw new ApiError(502, '排程服务返回了无效的未安排任务。', 'invalid_response')
  }

  return {
    taskId: value.taskId,
    title: value.title,
    reason: value.reason,
  }
}

function parsePreviewResponse(value: unknown): SchedulingPreviewResponse {
  if (
    !isRecord(value) ||
    typeof value.date !== 'string' ||
    !isRecord(value.range) ||
    typeof value.range.start !== 'string' ||
    typeof value.range.end !== 'string' ||
    typeof value.strategy !== 'string' ||
    !Array.isArray(value.scheduled) ||
    !Array.isArray(value.unscheduled) ||
    !isRecord(value.summary)
  ) {
    throw new ApiError(502, '排程服务返回了无法识别的数据。', 'invalid_response')
  }

  const summaryFields = [
    'totalTasks',
    'scheduledTasks',
    'unscheduledTasks',
    'skippedCompletedTasks',
    'scheduledMinutes',
  ] as const
  const summary = value.summary
  if (summaryFields.some((field) => !isNonNegativeInteger(summary[field]))) {
    throw new ApiError(502, '排程服务返回了无效的摘要。', 'invalid_response')
  }

  return {
    date: value.date,
    range: {
      start: value.range.start,
      end: value.range.end,
    },
    strategy: value.strategy,
    scheduled: value.scheduled.map(parseScheduledTask),
    unscheduled: value.unscheduled.map(parseUnscheduledTask),
    summary: {
      totalTasks: summary.totalTasks as number,
      scheduledTasks: summary.scheduledTasks as number,
      unscheduledTasks: summary.unscheduledTasks as number,
      skippedCompletedTasks: summary.skippedCompletedTasks as number,
      scheduledMinutes: summary.scheduledMinutes as number,
    },
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
      : `排程请求失败（HTTP ${response.status}）。`
  const code = typeof body?.error === 'string' ? body.error : undefined
  return new ApiError(response.status, message, code)
}

export function toSchedulingTaskDto(task: Task): SchedulingTaskDto {
  const dto: SchedulingTaskDto = {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
  }

  if (task.deadlineDate) {
    dto.deadlineDate = task.deadlineDate
    if (task.deadlineTime) {
      dto.deadlineTime = task.deadlineTime
    }
  }
  if (task.estimatedDurationMinutes !== undefined) {
    dto.estimatedDurationMinutes = task.estimatedDurationMinutes
  }

  return dto
}

export async function previewSchedule(
  request: SchedulingPreviewRequest,
): Promise<SchedulingPreviewResponse> {
  let response: Response
  try {
    response = await fetch(SCHEDULING_PREVIEW_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
  } catch {
    throw new ApiError(0, '暂时无法连接排程服务。', 'network_error')
  }

  if (!response.ok) {
    throw await readError(response)
  }

  try {
    const value: unknown = await response.json()
    return parsePreviewResponse(value)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(502, '排程服务返回了无效 JSON。', 'invalid_response')
  }
}
