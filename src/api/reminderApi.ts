import { ApiError } from './eventApi.ts'

const CONFIGURED_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
const API_BASE_URL = CONFIGURED_API_BASE_URL.replace(/\/$/, '')
const REMINDERS_URL = `${API_BASE_URL}/reminders`

export type ReminderStatus = 'pending' | 'acknowledged'

export type ReminderDto = {
  id: string
  eventId: string
  title: string
  date: string
  startTime: string
  scheduledFor: string
  triggeredAt: string
  status: ReminderStatus
}

type ApiErrorBody = {
  error?: unknown
  message?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isReminderStatus(value: unknown): value is ReminderStatus {
  return value === 'pending' || value === 'acknowledged'
}

export function parseReminder(value: unknown): ReminderDto {
  if (!isRecord(value)) {
    throw new ApiError(502, '提醒服务返回了无法识别的数据。', 'invalid_response')
  }

  const id = typeof value.id === 'string' ? value.id : value.reminderId
  const requiredStrings = [
    id,
    value.eventId,
    value.title,
    value.date,
    value.startTime,
    value.scheduledFor,
    value.triggeredAt,
  ]
  if (requiredStrings.some((field) => typeof field !== 'string' || !field.trim())) {
    throw new ApiError(502, '提醒服务返回了不完整的数据。', 'invalid_response')
  }

  const status = value.status === undefined ? 'pending' : value.status
  if (!isReminderStatus(status)) {
    throw new ApiError(502, '提醒服务返回了无效的状态。', 'invalid_response')
  }

  return {
    id: id as string,
    eventId: value.eventId as string,
    title: value.title as string,
    date: value.date as string,
    startTime: value.startTime as string,
    scheduledFor: value.scheduledFor as string,
    triggeredAt: value.triggeredAt as string,
    status,
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
      : `提醒请求失败（HTTP ${response.status}）。`
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
    throw new ApiError(0, '暂时无法连接提醒服务。', 'network_error')
  }

  if (!response.ok) {
    throw await readError(response)
  }
  try {
    return await response.json()
  } catch {
    throw new ApiError(502, '提醒服务返回了无效 JSON。', 'invalid_response')
  }
}

export function getReminderStreamUrl(): string {
  return `${REMINDERS_URL}/stream`
}

export async function getPendingReminders(): Promise<ReminderDto[]> {
  const value = await requestJson(`${REMINDERS_URL}/pending`)
  if (!Array.isArray(value)) {
    throw new ApiError(502, '提醒服务没有返回列表。', 'invalid_response')
  }
  return value.map(parseReminder)
}

export async function ackReminder(id: string): Promise<ReminderDto> {
  return parseReminder(await requestJson(
    `${REMINDERS_URL}/${encodeURIComponent(id)}/ack`,
    { method: 'POST' },
  ))
}
