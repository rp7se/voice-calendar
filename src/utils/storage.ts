import type {
  CalendarEvent,
  CalendarEventInput,
  CountdownItem,
  CountdownItemInput,
  EventCategory,
  EventCategoryInput,
} from '../types/calendar.ts'

/** localStorage key 统一管理 */
const STORAGE_KEYS = {
  EVENTS: 'voice-calendar:events',
  COUNTDOWNS: 'voice-calendar:countdowns',
  CATEGORIES: 'voice-calendar:categories',
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

export function getEvents(): CalendarEvent[] {
  return readFromStorage<CalendarEvent[]>(STORAGE_KEYS.EVENTS, [])
}

export function saveEvents(events: CalendarEvent[]): void {
  writeToStorage(STORAGE_KEYS.EVENTS, events)
}

export function addEvent(eventInput: CalendarEventInput): CalendarEvent {
  const timestamp = nowIso()
  const event: CalendarEvent = {
    ...eventInput,
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

// --- 分类 ---

export function getCategories(): EventCategory[] {
  return readFromStorage<EventCategory[]>(STORAGE_KEYS.CATEGORIES, [])
}

export function saveCategories(categories: EventCategory[]): void {
  writeToStorage(STORAGE_KEYS.CATEGORIES, categories)
}

export function addCategory(categoryInput: EventCategoryInput): EventCategory {
  const category: EventCategory = {
    ...categoryInput,
    id: createId(),
    createdAt: nowIso(),
  }
  const categories = getCategories()
  categories.push(category)
  saveCategories(categories)
  return category
}

export function deleteCategory(id: string): boolean {
  const categories = getCategories()
  const nextCategories = categories.filter((category) => category.id !== id)
  if (nextCategories.length === categories.length) {
    return false
  }
  saveCategories(nextCategories)
  return true
}
