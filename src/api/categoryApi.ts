import { ApiError } from './eventApi.ts'
import type { EventCategory, EventCategoryInput } from '../types/calendar.ts'

const CONFIGURED_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
const API_BASE_URL = CONFIGURED_API_BASE_URL.replace(/\/$/, '')
const CATEGORIES_URL = `${API_BASE_URL}/categories`

export type BackendCategoryDto = EventCategory

export type CategoryWriteRequest = {
  id?: string
  name: string
  description?: string
}

type ApiErrorBody = {
  error?: unknown
  message?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseBackendCategory(value: unknown): BackendCategoryDto {
  if (!isRecord(value)) {
    throw new ApiError(502, '分类服务返回了无法识别的数据。', 'invalid_response')
  }

  const requiredStrings = ['id', 'name', 'createdAt', 'updatedAt'] as const
  if (requiredStrings.some((field) => typeof value[field] !== 'string')) {
    throw new ApiError(502, '分类服务返回了不完整的数据。', 'invalid_response')
  }
  if (value.description !== undefined && typeof value.description !== 'string') {
    throw new ApiError(502, '分类服务返回了无效的描述。', 'invalid_response')
  }

  return {
    id: value.id as string,
    name: value.name as string,
    description: value.description as string | undefined,
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
  }
}

export function toCategoryWriteRequest(
  input: EventCategoryInput,
  legacyId?: string,
): CategoryWriteRequest {
  return {
    ...(legacyId ? { id: legacyId } : {}),
    name: input.name,
    description: input.description,
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
      : `分类请求失败（HTTP ${response.status}）。`
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
    throw new ApiError(0, '暂时无法连接分类服务。', 'network_error')
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
    throw new ApiError(502, '分类服务返回了无效 JSON。', 'invalid_response')
  }
}

export async function getCategories(): Promise<EventCategory[]> {
  const value = await requestJson(CATEGORIES_URL)
  if (!Array.isArray(value)) {
    throw new ApiError(502, '分类服务没有返回列表。', 'invalid_response')
  }
  return value.map(parseBackendCategory)
}

export async function getCategoryById(id: string): Promise<EventCategory> {
  return parseBackendCategory(
    await requestJson(`${CATEGORIES_URL}/${encodeURIComponent(id)}`),
  )
}

export async function createCategory(
  input: EventCategoryInput,
  legacyId?: string,
): Promise<EventCategory> {
  return parseBackendCategory(await requestJson(CATEGORIES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toCategoryWriteRequest(input, legacyId)),
  }))
}

export async function updateCategory(
  id: string,
  input: EventCategoryInput,
): Promise<EventCategory> {
  return parseBackendCategory(
    await requestJson(`${CATEGORIES_URL}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toCategoryWriteRequest(input)),
    }),
  )
}

export async function deleteCategory(id: string): Promise<void> {
  await requestJson(`${CATEGORIES_URL}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
