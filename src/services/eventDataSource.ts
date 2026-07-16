import {
  ApiError,
  createEvent as createBackendEvent,
  deleteEvent as deleteBackendEvent,
  updateEvent as updateBackendEvent,
} from '../api/eventApi.ts'
import type { CalendarEvent, CalendarEventInput } from '../types/calendar.ts'
import {
  EventMigrationError,
  migrateLegacyEvents,
} from '../migrations/eventMigration.ts'
import {
  addEvent as addLocalEvent,
  deleteEvent as deleteLocalEvent,
  getEvents as getLocalEvents,
  updateEvent as updateLocalEvent,
} from '../utils/storage.ts'

export type EventDataSourceMode = 'local' | 'backend'

export const EVENT_DATA_SOURCE: EventDataSourceMode =
  import.meta.env.VITE_EVENT_DATA_SOURCE === 'local' ? 'local' : 'backend'

let backendEvents: CalendarEvent[] = []

export function isBackendEventDataSource(): boolean {
  return EVENT_DATA_SOURCE === 'backend'
}

export async function loadEvents(): Promise<CalendarEvent[]> {
  if (!isBackendEventDataSource()) {
    return getLocalEvents()
  }

  try {
    const migration = await migrateLegacyEvents()
    backendEvents = migration.events
  } catch (error) {
    if (error instanceof EventMigrationError) {
      backendEvents = error.result.events
    }
    throw error
  }
  return getEvents()
}

export function getEvents(): CalendarEvent[] {
  const events = isBackendEventDataSource() ? backendEvents : getLocalEvents()
  return events.map((event) => ({ ...event }))
}

export function getEventsByDate(date: string): CalendarEvent[] {
  return getEvents().filter((event) => event.date === date)
}

export function getEventsByCategory(categoryId: string): CalendarEvent[] {
  return getEvents().filter((event) => event.categoryId === categoryId)
}

export async function createEvent(event: CalendarEventInput): Promise<CalendarEvent> {
  if (!isBackendEventDataSource()) {
    return addLocalEvent(event)
  }

  const created = await createBackendEvent(event)
  backendEvents = [...backendEvents, created]
  return created
}

export async function updateEvent(
  id: string,
  event: CalendarEventInput,
): Promise<CalendarEvent | null> {
  if (!isBackendEventDataSource()) {
    return updateLocalEvent(id, event)
  }

  const updated = await updateBackendEvent(id, event)
  backendEvents = backendEvents.map((item) => (item.id === id ? updated : item))
  return updated
}

export async function deleteEvent(id: string): Promise<boolean> {
  if (!isBackendEventDataSource()) {
    return deleteLocalEvent(id)
  }

  await deleteBackendEvent(id)
  backendEvents = backendEvents.filter((event) => event.id !== id)
  return true
}

export function getEventErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError || error instanceof EventMigrationError) {
    return error.message
  }
  return fallback
}
