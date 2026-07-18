import type {
  CalendarEvent,
  CalendarEventInput,
  CountdownItem,
  CountdownItemInput,
  CategoryDateLink,
  ReminderMinutesBefore,
} from '../types/calendar.ts'

export const LEGACY_EVENT_STORAGE_KEY = 'voice-calendar:events'
export const LEGACY_CATEGORY_STORAGE_KEY = 'voice-calendar:categories'

/** localStorage key 统一管理 */
const STORAGE_KEYS = {
  EVENTS: LEGACY_EVENT_STORAGE_KEY,
  COUNTDOWNS: 'voice-calendar:countdowns',
  CATEGORY_DATE_LINKS: 'voice-calendar:category-date-links',
} as const

function createId(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

/** 安全读取 localStorage，处理空值与 JSON 解析失败 */
function readFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null || raw.trim() === '') {
      return fallback
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** 安全写入 localStorage */
function writeToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 存储空间不足或隐私模式下不可用时静默失败，避免页面崩溃
  }
}

// --- 日程 ---

type StoredCalendarEvent = Omit<CalendarEvent, 'reminderMinutesBefore'> & {
  reminderMinutesBefore?: ReminderMinutesBefore
}

export function getEvents(): CalendarEvent[] {
  return readFromStorage<StoredCalendarEvent[]>(STORAGE_KEYS.EVENTS, []).map(
    (event) => {
      const reminderMinutesBefore =
        event.reminderMinutesBefore === undefined
          ? event.reminderEnabled
            ? 0
            : null
          : event.reminderMinutesBefore
      return {
        ...event,
        reminderEnabled: reminderMinutesBefore !== null,
        reminderMinutesBefore,
      }
    },
  )
}

export function saveEvents(events: CalendarEvent[]): void {
  writeToStorage(STORAGE_KEYS.EVENTS, events)
}

export function addEvent(eventInput: CalendarEventInput): CalendarEvent {
  const timestamp = nowIso()
  const event: CalendarEvent = {
    ...eventInput,
    reminderEnabled: eventInput.reminderMinutesBefore !== null,
    id: createId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const events = getEvents()
  events.push(event)
  saveEvents(events)
  return event
}

export function updateEvent(
  id: string,
  partialEvent: Partial<CalendarEventInput>,
): CalendarEvent | null {
  const events = getEvents()
  const index = events.findIndex((event) => event.id === id)
  if (index === -1) {
    return null
  }

  const updated: CalendarEvent = {
    ...events[index],
    ...partialEvent,
    reminderEnabled:
      partialEvent.reminderMinutesBefore !== undefined
        ? partialEvent.reminderMinutesBefore !== null
        : events[index].reminderEnabled,
    id: events[index].id,
    createdAt: events[index].createdAt,
    updatedAt: nowIso(),
  }
  events[index] = updated
  saveEvents(events)
  return updated
}

export function deleteEvent(id: string): boolean {
  const events = getEvents()
  const nextEvents = events.filter((event) => event.id !== id)
  if (nextEvents.length === events.length) {
    return false
  }
  saveEvents(nextEvents)
  return true
}

export function getEventsByDate(date: string): CalendarEvent[] {
  return getEvents().filter((event) => event.date === date)
}

export function getEventsByCategory(categoryId: string): CalendarEvent[] {
  return getEvents().filter((event) => event.categoryId === categoryId)
}

// --- 倒计时 ---

export function getCountdowns(): CountdownItem[] {
  return readFromStorage<CountdownItem[]>(STORAGE_KEYS.COUNTDOWNS, [])
}

export function saveCountdowns(countdowns: CountdownItem[]): void {
  writeToStorage(STORAGE_KEYS.COUNTDOWNS, countdowns)
}

export function addCountdown(countdownInput: CountdownItemInput): CountdownItem {
  const countdown: CountdownItem = {
    ...countdownInput,
    id: createId(),
    createdAt: nowIso(),
  }
  const countdowns = getCountdowns()
  countdowns.push(countdown)
  saveCountdowns(countdowns)
  return countdown
}

export function deleteCountdown(id: string): boolean {
  const countdowns = getCountdowns()
  const nextCountdowns = countdowns.filter((item) => item.id !== id)
  if (nextCountdowns.length === countdowns.length) {
    return false
  }
  saveCountdowns(nextCountdowns)
  return true
}

// --- 分类日期关联 ---

export function getCategoryDateLinks(): CategoryDateLink[] {
  return readFromStorage<CategoryDateLink[]>(STORAGE_KEYS.CATEGORY_DATE_LINKS, [])
}

export function saveCategoryDateLinks(links: CategoryDateLink[]): void {
  writeToStorage(STORAGE_KEYS.CATEGORY_DATE_LINKS, links)
}

export function deleteCategoryDateLinks(categoryId: string): void {
  saveCategoryDateLinks(
    getCategoryDateLinks().filter((link) => link.categoryId !== categoryId),
  )
}

export function addDateToCategory(categoryId: string, date: string): CategoryDateLink {
  const links = getCategoryDateLinks()
  const existing = links.find(
    (link) => link.categoryId === categoryId && link.date === date,
  )

  if (existing) {
    return existing
  }

  const link: CategoryDateLink = {
    id: createId(),
    categoryId,
    date,
    createdAt: nowIso(),
  }
  links.push(link)
  saveCategoryDateLinks(links)
  return link
}

export function removeDateFromCategory(categoryId: string, date: string): boolean {
  const links = getCategoryDateLinks()
  const nextLinks = links.filter(
    (link) => !(link.categoryId === categoryId && link.date === date),
  )
  if (nextLinks.length === links.length) {
    return false
  }
  saveCategoryDateLinks(nextLinks)
  return true
}

export function getDatesByCategory(categoryId: string): string[] {
  return getCategoryDateLinks()
    .filter((link) => link.categoryId === categoryId)
    .map((link) => link.date)
    .sort((a, b) => a.localeCompare(b))
}
