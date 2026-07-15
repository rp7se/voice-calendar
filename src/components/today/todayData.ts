import type { CalendarEvent } from '../../types/calendar.ts'
import { formatDate } from '../../utils/date.ts'
import { getEventsByDate } from '../../utils/storage.ts'
import { filterEventsByCategory } from '../category/categoryFilters.ts'

export function getTodayKey(date = new Date()): string {
  return formatDate(date)
}

export function getTodayEvents(
  date = new Date(),
  categoryId: string | null = null,
): CalendarEvent[] {
  return sortEventsByTime(filterEventsByCategory(getEventsByDate(getTodayKey(date)), categoryId))
}

export function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const startDiff = a.startTime.localeCompare(b.startTime)
    if (startDiff !== 0) {
      return startDiff
    }
    return a.title.localeCompare(b.title)
  })
}

export function getMinutesFromTime(time: string): number | null {
  const [hour, minute] = time.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null
  }
  return hour * 60 + minute
}

export function getCurrentMinutes(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function getNextTodayEvent(events: CalendarEvent[], date = new Date()) {
  const currentMinutes = getCurrentMinutes(date)
  return events.find((event) => {
    const startMinutes = getMinutesFromTime(event.startTime)
    return startMinutes !== null && startMinutes >= currentMinutes
  }) ?? null
}

export function formatEventTimeRange(event: CalendarEvent): string {
  return event.endTime ? `${event.startTime} - ${event.endTime}` : event.startTime
}

export function isEventActiveNow(event: CalendarEvent, date = new Date()): boolean {
  const startMinutes = getMinutesFromTime(event.startTime)
  if (startMinutes === null) {
    return false
  }

  const currentMinutes = getCurrentMinutes(date)
  const endMinutes = event.endTime ? getMinutesFromTime(event.endTime) : startMinutes + 30
  return endMinutes !== null && currentMinutes >= startMinutes && currentMinutes <= endMinutes
}
