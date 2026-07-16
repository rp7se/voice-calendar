import type { CalendarEvent, CalendarEventInput, EventType } from '../types/calendar.ts'

const EVENT_TYPES: EventType[] = ['schedule', 'course', 'work', 'reminder']
const CONFIGURED_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
const API_BASE_URL = CONFIGURED_API_BASE_URL.replace(/\/$/, '')
const EVENTS_URL = `${API_BASE_URL}/events`

export type BackendEventDto = {
  id: string
  title: string
  description: string
  date: string
  startTime: string
  endTime?: string
  type: EventType
  categoryId?: string
  reminderEnabled: boolean
  reminderMinutesBefore: number | null
  createdAt: string
  updatedAt: string
}

export type EventWriteRequest = {
  title: string
  description: string
  date: string
  startTime: string
  endTime?: string
  type: EventType
  categoryId?: string
  reminderEnabled: boolean
  reminderMinutesBefore: number | null
}

type ApiErrorBody = {
  error?: unknown
  message?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && EVENT_TYPES.includes(value as EventType)
}

function parseBackendEvent(value: unknown): BackendEventDto {
  if (!isRecord(value)) {
    throw new ApiError(502, '日程服务返回了无法识别的数据。', 'invalid_response')
  }

  const requiredStrings = [
    'id',
    'title',
    'description',
    'date',
    'startTime',
    'createdAt',
    'updatedAt',
  ] as const
  if (requiredStrings.some((field) => typeof value[field] !== 'string')) {
    throw new ApiError(502, '日程服务返回了不完整的数据。', 'invalid_response')
  }
  if (!isEventType(value.type) || typeof value.reminderEnabled !== 'boolean') {
    throw new ApiError(502, '日程服务返回了无效的字段类型。', 'invalid_response')
  }
  if (value.endTime !== undefined && typeof value.endTime !== 'string') {
    throw new ApiError(502, '日程服务返回了无效的结束时间。', 'invalid_response')
  }
  if (value.categoryId !== undefined && typeof value.categoryId !== 'string') {
    throw new ApiError(502, '日程服务返回了无效的分类标识。', 'invalid_response')
  }
  if (
    value.reminderMinutesBefore !== undefined &&
    value.reminderMinutesBefore !== null &&
    (!Number.isInteger(value.reminderMinutesBefore) ||
      (value.reminderMinutesBefore as number) < 0 ||
      (value.reminderMinutesBefore as number) > 10080)
  ) {
    throw new ApiError(502, '日程服务返回了无效的提醒时间。', 'invalid_response')
  }

  const reminderMinutesBefore =
    value.reminderMinutesBefore === undefined
      ? value.reminderEnabled
        ? 0
        : null
      : (value.reminderMinutesBefore as number | null)
  if (value.reminderEnabled !== (reminderMinutesBefore !== null)) {
    throw new ApiError(502, '日程服务返回了不一致的提醒配置。', 'invalid_response')
  }

  return {
    id: value.id as string,
    title: value.title as string,
    description: value.description as string,
    date: value.date as string,
    startTime: value.startTime as string,
    endTime: value.endTime as string | undefined,
    type: value.type,
    categoryId: value.categoryId as string | undefined,
    reminderEnabled: value.reminderEnabled,
    reminderMinutesBefore,
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
  }
}

function toCalendarEvent(dto: BackendEventDto): CalendarEvent {
  return { ...dto }
}

export function toEventWriteRequest(event: CalendarEventInput): EventWriteRequest {
  return {
    title: event.title,
    description: event.description,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    type: event.type,
    categoryId: event.categoryId,
    reminderEnabled: event.reminderEnabled,
    reminderMinutesBefore: event.reminderEnabled
      ? (event.reminderMinutesBefore ?? 0)
      : null,
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
      : `日程请求失败（HTTP ${response.status}）。`
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
    throw new ApiError(0, '暂时无法连接日程服务。', 'network_error')
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
    throw new ApiError(502, '日程服务返回了无效 JSON。', 'invalid_response')
  }
}

export async function getEvents(): Promise<CalendarEvent[]> {
  const value = await requestJson(EVENTS_URL)
  if (!Array.isArray(value)) {
    throw new ApiError(502, '日程服务没有返回列表。', 'invalid_response')
  }
  return value.map((item) => toCalendarEvent(parseBackendEvent(item)))
}

export async function getEventById(id: string): Promise<CalendarEvent> {
  const value = await requestJson(`${EVENTS_URL}/${encodeURIComponent(id)}`)
  return toCalendarEvent(parseBackendEvent(value))
}

export async function createEvent(event: CalendarEventInput): Promise<CalendarEvent> {
  const value = await requestJson(EVENTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toEventWriteRequest(event)),
  })
  return toCalendarEvent(parseBackendEvent(value))
}

export async function updateEvent(
  id: string,
  event: CalendarEventInput,
): Promise<CalendarEvent> {
  const value = await requestJson(`${EVENTS_URL}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toEventWriteRequest(event)),
  })
  return toCalendarEvent(parseBackendEvent(value))
}

export async function deleteEvent(id: string): Promise<void> {
  await requestJson(`${EVENTS_URL}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
