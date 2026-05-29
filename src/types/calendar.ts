export type EventType = 'schedule' | 'course' | 'work' | 'reminder'

export type CalendarEvent = {
  id: string
  title: string
  description: string
  date: string
  startTime: string
  endTime?: string
  type: EventType
  categoryId?: string
  reminderEnabled: boolean
  createdAt: string
  updatedAt: string
}

export type CountdownItem = {
  id: string
  title: string
  targetDate: string
  description?: string
  createdAt: string
}

export type EventCategory = {
  id: string
  name: string
  description?: string
  createdAt: string
}

export type HolidayType = 'public' | 'traditional' | 'custom'

export type HolidayInfo = {
  date: string
  name: string
  type: HolidayType
}

export type CalendarEventInput = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>
export type CountdownItemInput = Omit<CountdownItem, 'id' | 'createdAt'>
export type EventCategoryInput = Omit<EventCategory, 'id' | 'createdAt'>
