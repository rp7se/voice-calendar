import type { CalendarEvent, EventCategory, EventType } from '../../types/calendar.ts'
import { filterEventsByCategory } from '../category/categoryFilters.ts'
import { getCategories, getEventsByDate } from '../../utils/storage.ts'
import { getHolidayByDate } from '../../utils/holiday.ts'

type CalendarDayContextProps = {
  selectedDate: string
  selectedCategoryId?: string | null
  selectedCategoryName?: string | null
  eventsVersion?: number
  categoriesVersion?: number
  onOpenDayDetail: () => void
}

const WEEKDAY_LABELS = [
  '星期日',
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六',
]

const TYPE_LABELS: Record<EventType, string> = {
  schedule: '日程',
  course: '课程',
  work: '工作',
  reminder: '提醒',
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDateTitle(dateKey: string): string {
  const date = parseDateKey(dateKey)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const timeDiff = a.startTime.localeCompare(b.startTime)
    if (timeDiff !== 0) {
      return timeDiff
    }
    return a.title.localeCompare(b.title)
  })
}

function buildCategoryMap(categories: EventCategory[]): Record<string, string> {
  return categories.reduce<Record<string, string>>((map, category) => {
    map[category.id] = category.name
    return map
  }, {})
}

export default function CalendarDayContext({
  selectedDate,
  selectedCategoryId = null,
  selectedCategoryName = null,
  onOpenDayDetail,
}: CalendarDayContextProps) {
  const selectedDay = parseDateKey(selectedDate)
  const holiday = getHolidayByDate(selectedDate)
  const events = sortEventsByTime(
    filterEventsByCategory(getEventsByDate(selectedDate), selectedCategoryId),
  )
  const categoryMap = buildCategoryMap(getCategories())

  return (
    <section className="calendar-day-context" aria-label="Selected date detail">
      <header className="calendar-day-context-header">
        <span>Selected Date</span>
        <h2>{formatDateTitle(selectedDate)}</h2>
        <p>{WEEKDAY_LABELS[selectedDay.getDay()]}</p>
        {holiday && (
          <span className={`calendar-context-holiday calendar-day-holiday--${holiday.type}`}>
            {holiday.name}
          </span>
        )}
        {selectedCategoryName && (
          <span className="calendar-context-filter">正在查看：{selectedCategoryName}</span>
        )}
      </header>

      <div className="calendar-context-summary">
        <span>{events.length}</span>
        <p>当日日程</p>
      </div>

      {events.length === 0 ? (
        <p className="calendar-context-empty">
          当天还没有安排。可以添加日程，或继续浏览其他日期。
        </p>
      ) : (
        <ul className="calendar-context-event-list">
          {events.map((event) => (
            <li key={event.id}>
              <button type="button" onClick={onOpenDayDetail}>
                <time>{event.startTime || '全天'}</time>
                <strong>{event.title}</strong>
                <span>
                  {event.categoryId && categoryMap[event.categoryId]
                    ? categoryMap[event.categoryId]
                    : TYPE_LABELS[event.type]}
                  {event.endTime ? ` · ${event.startTime} - ${event.endTime}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="calendar-context-add"
        onClick={onOpenDayDetail}
      >
        + 添加日程
      </button>
    </section>
  )
}
