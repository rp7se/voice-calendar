import type { CalendarEvent, EventCategory } from '../../types/calendar.ts'
import { getCategories, getCategoryDateLinks, getEvents } from '../../utils/storage.ts'

export function getCategoryDateSet(categoryId: string): Set<string> {
  return new Set(
    getCategoryDateLinks()
      .filter((link) => link.categoryId === categoryId)
      .map((link) => link.date),
  )
}

export function eventMatchesCategory(
  event: CalendarEvent,
  categoryId: string | null,
  linkedDates?: Set<string>,
): boolean {
  if (!categoryId) {
    return true
  }

  const dates = linkedDates ?? getCategoryDateSet(categoryId)
  return event.categoryId === categoryId || dates.has(event.date)
}

export function filterEventsByCategory(
  events: CalendarEvent[],
  categoryId: string | null,
): CalendarEvent[] {
  if (!categoryId) {
    return events
  }

  const linkedDates = getCategoryDateSet(categoryId)
  return events.filter((event) => eventMatchesCategory(event, categoryId, linkedDates))
}

export function getCategoryById(categoryId: string | null): EventCategory | null {
  if (!categoryId) {
    return null
  }

  return getCategories().find((category) => category.id === categoryId) ?? null
}

export function buildCategoryEventCounts(
  categories: EventCategory[],
): Record<string, number> {
  const events = getEvents()

  return categories.reduce<Record<string, number>>((counts, category) => {
    const linkedDates = getCategoryDateSet(category.id)
    counts[category.id] = events.filter((event) =>
      eventMatchesCategory(event, category.id, linkedDates),
    ).length
    return counts
  }, {})
}
