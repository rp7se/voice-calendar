import {
  createEvent as createBackendEvent,
  getEvents as getBackendEvents,
  toEventWriteRequest,
} from '../api/eventApi.ts'
import type { CalendarEvent, CalendarEventInput, EventType } from '../types/calendar.ts'
import { LEGACY_EVENT_STORAGE_KEY } from '../utils/storage.ts'

export const EVENT_MIGRATION_MARKER_KEY = 'voice-calendar:event-migration:v1'

const EVENT_TYPES: EventType[] = ['schedule', 'course', 'work', 'reminder']

type EventMigrationMarker = {
  version: 1
  completed: true
  completedAt: string
}

type LegacyReadResult = {
  events: CalendarEventInput[]
  invalid: number
  readFailed: boolean
}

export type EventMigrationResult = {
  migrated: number
  skipped: number
  failed: number
  completed: boolean
  alreadyCompleted: boolean
  legacyCount: number
  backendCount: number
  events: CalendarEvent[]
}

export class EventMigrationError extends Error {
  readonly result: EventMigrationResult

  constructor(message: string, result: EventMigrationResult) {
    super(message)
    this.name = 'EventMigrationError'
    this.result = result
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && EVENT_TYPES.includes(value as EventType)
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    year > 0 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isValidTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) {
    return false
  }
  return Number(match[1]) <= 23 && Number(match[2]) <= 59
}

function parseLegacyEvent(value: unknown): CalendarEventInput | null {
  if (!isRecord(value)) {
    return null
  }

  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const description = value.description
  const date = value.date
  const startTime = value.startTime
  const endTime = value.endTime
  const categoryId = value.categoryId

  if (
    !title ||
    typeof description !== 'string' ||
    typeof date !== 'string' ||
    !isValidDate(date) ||
    typeof startTime !== 'string' ||
    !isValidTime(startTime) ||
    !isEventType(value.type) ||
    typeof value.reminderEnabled !== 'boolean'
  ) {
    return null
  }

  if (
    endTime !== undefined &&
    endTime !== null &&
    (typeof endTime !== 'string' || !isValidTime(endTime))
  ) {
    return null
  }

  if (
    categoryId !== undefined &&
    categoryId !== null &&
    (typeof categoryId !== 'string' || !categoryId.trim())
  ) {
    return null
  }

  return {
    title,
    description,
    date,
    startTime,
    endTime: typeof endTime === 'string' ? endTime : undefined,
    type: value.type,
    categoryId: typeof categoryId === 'string' ? categoryId : undefined,
    reminderEnabled: value.reminderEnabled,
  }
}

function readLegacyEvents(): LegacyReadResult {
  let raw: string | null
  try {
    raw = localStorage.getItem(LEGACY_EVENT_STORAGE_KEY)
  } catch {
    return { events: [], invalid: 0, readFailed: true }
  }

  if (raw === null || !raw.trim()) {
    return { events: [], invalid: 0, readFailed: false }
  }

  let value: unknown
  try {
    value = JSON.parse(raw) as unknown
  } catch {
    return { events: [], invalid: 1, readFailed: true }
  }

  if (!Array.isArray(value)) {
    return { events: [], invalid: 1, readFailed: true }
  }

  const events: CalendarEventInput[] = []
  let invalid = 0
  for (const item of value) {
    const event = parseLegacyEvent(item)
    if (event) {
      events.push(event)
    } else {
      invalid += 1
    }
  }
  return { events, invalid, readFailed: false }
}

function isMigrationCompleted(): boolean {
  try {
    const raw = localStorage.getItem(EVENT_MIGRATION_MARKER_KEY)
    if (!raw) {
      return false
    }
    const value: unknown = JSON.parse(raw)
    return (
      isRecord(value) &&
      value.version === 1 &&
      value.completed === true &&
      typeof value.completedAt === 'string'
    )
  } catch {
    return false
  }
}

function writeMigrationMarker(): boolean {
  const marker: EventMigrationMarker = {
    version: 1,
    completed: true,
    completedAt: new Date().toISOString(),
  }

  try {
    localStorage.setItem(EVENT_MIGRATION_MARKER_KEY, JSON.stringify(marker))
    return isMigrationCompleted()
  } catch {
    return false
  }
}

function eventFingerprint(event: CalendarEventInput): string {
  const request = toEventWriteRequest(event)
  return JSON.stringify([
    request.title.trim(),
    request.description,
    request.date,
    request.startTime,
    request.endTime ?? null,
    request.type,
    request.categoryId ?? null,
    request.reminderEnabled,
  ])
}

function countEvents(events: readonly CalendarEventInput[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const event of events) {
    const fingerprint = eventFingerprint(event)
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1)
  }
  return counts
}

function countMissingEvents(
  legacyEvents: readonly CalendarEventInput[],
  backendEvents: readonly CalendarEvent[],
): number {
  const available = countEvents(backendEvents)
  let missing = 0

  for (const event of legacyEvents) {
    const fingerprint = eventFingerprint(event)
    const count = available.get(fingerprint) ?? 0
    if (count > 0) {
      available.set(fingerprint, count - 1)
    } else {
      missing += 1
    }
  }
  return missing
}

function logMigrationResult(result: EventMigrationResult): void {
  console.info('[EventMigration]', {
    legacyCount: result.legacyCount,
    backendCount: result.backendCount,
    migratedCount: result.migrated,
    skippedDuplicateCount: result.skipped,
    failedCount: result.failed,
    completed: result.completed,
    alreadyCompleted: result.alreadyCompleted,
  })
}

function incompleteResult(
  legacyCount: number,
  failed: number,
  events: CalendarEvent[] = [],
): EventMigrationResult {
  return {
    migrated: 0,
    skipped: 0,
    failed,
    completed: false,
    alreadyCompleted: false,
    legacyCount,
    backendCount: events.length,
    events,
  }
}

async function runLegacyEventMigration(): Promise<EventMigrationResult> {
  if (isMigrationCompleted()) {
    const events = await getBackendEvents()
    const result: EventMigrationResult = {
      migrated: 0,
      skipped: 0,
      failed: 0,
      completed: true,
      alreadyCompleted: true,
      legacyCount: 0,
      backendCount: events.length,
      events,
    }
    logMigrationResult(result)
    return result
  }

  const legacy = readLegacyEvents()
  const legacyCount = legacy.events.length + legacy.invalid
  if (legacy.readFailed) {
    const result = incompleteResult(legacyCount, Math.max(legacy.invalid, 1))
    logMigrationResult(result)
    throw new EventMigrationError(
      '旧日程数据无法安全读取，迁移尚未完成。旧数据已保留。',
      result,
    )
  }

  let backendEvents: CalendarEvent[]
  try {
    backendEvents = await getBackendEvents()
  } catch {
    const result = incompleteResult(legacyCount, legacyCount)
    logMigrationResult(result)
    throw new EventMigrationError(
      '无法连接日程服务，旧日程尚未迁移。',
      result,
    )
  }

  const availableBackendEvents = countEvents(backendEvents)
  let migrated = 0
  let skipped = 0

  for (const event of legacy.events) {
    const fingerprint = eventFingerprint(event)
    const duplicateCount = availableBackendEvents.get(fingerprint) ?? 0
    if (duplicateCount > 0) {
      availableBackendEvents.set(fingerprint, duplicateCount - 1)
      skipped += 1
      continue
    }

    try {
      await createBackendEvent(event)
      migrated += 1
    } catch {
      // Verification below decides completion. A failed response may still have
      // reached the server, so the final GET remains authoritative.
    }
  }

  try {
    backendEvents = await getBackendEvents()
  } catch {
    const result: EventMigrationResult = {
      migrated,
      skipped,
      failed: Math.max(legacy.invalid, legacy.events.length - skipped - migrated),
      completed: false,
      alreadyCompleted: false,
      legacyCount,
      backendCount: backendEvents.length,
      events: backendEvents,
    }
    logMigrationResult(result)
    throw new EventMigrationError(
      '旧日程迁移后无法完成验证，迁移标记尚未写入。旧数据已保留。',
      result,
    )
  }

  const missing = countMissingEvents(legacy.events, backendEvents)
  const failed = legacy.invalid + missing
  if (failed > 0) {
    const result: EventMigrationResult = {
      migrated,
      skipped,
      failed,
      completed: false,
      alreadyCompleted: false,
      legacyCount,
      backendCount: backendEvents.length,
      events: backendEvents,
    }
    logMigrationResult(result)
    throw new EventMigrationError(
      '旧日程迁移暂未完成，请确认日程服务正常运行。旧数据已保留。',
      result,
    )
  }

  if (!writeMigrationMarker()) {
    const result: EventMigrationResult = {
      migrated,
      skipped,
      failed: 1,
      completed: false,
      alreadyCompleted: false,
      legacyCount,
      backendCount: backendEvents.length,
      events: backendEvents,
    }
    logMigrationResult(result)
    throw new EventMigrationError(
      '旧日程已写入日程服务，但无法保存迁移完成标记。旧数据已保留。',
      result,
    )
  }

  const result: EventMigrationResult = {
    migrated,
    skipped,
    failed: 0,
    completed: true,
    alreadyCompleted: false,
    legacyCount,
    backendCount: backendEvents.length,
    events: backendEvents,
  }
  logMigrationResult(result)
  return result
}

let activeMigration: Promise<EventMigrationResult> | null = null

export function migrateLegacyEvents(): Promise<EventMigrationResult> {
  if (activeMigration) {
    return activeMigration
  }

  const migration = runLegacyEventMigration()
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
