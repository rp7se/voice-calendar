export type EventType = 'schedule' | 'course' | 'work' | 'reminder'
export type ReminderMinutesBefore = number | null

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
  reminderMinutesBefore: ReminderMinutesBefore
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
  updatedAt: string
}

export type CategoryDateLink = {
  id: string
  categoryId: string
  date: string
  createdAt: string
}

export type HolidayType = 'public' | 'traditional' | 'custom'

export type HolidayInfo = {
  date: string
  name: string
  type: HolidayType
}

export type CalendarEventInput = Omit<
  CalendarEvent,
  'id' | 'reminderEnabled' | 'createdAt' | 'updatedAt'
>
export type CountdownItemInput = Omit<CountdownItem, 'id' | 'createdAt'>
export type EventCategoryInput = Omit<EventCategory, 'id' | 'createdAt' | 'updatedAt'>
