import type { DragEvent } from 'react'
import type { CalendarEvent, HolidayInfo } from '../../types/calendar.ts'
import type { CalendarDay } from '../../utils/date.ts'

type CalendarDayCellProps = {
  day: CalendarDay
  dateKey: string
  events: CalendarEvent[]
  holiday?: HolidayInfo
  isSelected: boolean
  isToday: boolean
  isCategoryLinked?: boolean
  isDragging: boolean
  onSelectDate: (date: Date) => void
  onDragStart: (event: DragEvent<HTMLButtonElement>, dateKey: string) => void
  onDragEnd: () => void
}

const MAX_VISIBLE_EVENTS = 2

export default function CalendarDayCell({
  day,
  dateKey,
  events,
  holiday,
  isSelected,
  isToday,
  isCategoryLinked = false,
  isDragging,
  onSelectDate,
  onDragStart,
  onDragEnd,
}: CalendarDayCellProps) {
  const visibleEvents = events.slice(0, MAX_VISIBLE_EVENTS)
  const hiddenEventCount = Math.max(0, events.length - visibleEvents.length)

  return (
    <button
      type="button"
      draggable={true}
      className={[
        'calendar-day',
        !day.isCurrentMonth && 'calendar-day--muted',
        isToday && 'calendar-day--today',
        isSelected && 'calendar-day--selected',
        isCategoryLinked && 'calendar-day--category-linked',
        isDragging && 'calendar-day--dragging',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={isSelected}
      onClick={() => onSelectDate(day.date)}
      onDragStart={(event) => onDragStart(event, dateKey)}
      onDragEnd={onDragEnd}
    >
      <span className="calendar-day-topline">
        <span className="calendar-day-number">{day.day}</span>
        {isToday && <span className="calendar-day-current">Today</span>}
      </span>

      {holiday && (
        <span className={`calendar-day-holiday calendar-day-holiday--${holiday.type}`}>
          {holiday.name}
        </span>
      )}

      {visibleEvents.length > 0 && (
        <span className="calendar-day-event-list">
          {visibleEvents.map((event) => (
            <span key={event.id} className="calendar-day-event">
              {event.startTime && <span>{event.startTime}</span>}
              {event.title}
            </span>
          ))}
        </span>
      )}

      {events.length > 0 && (
        <span className="calendar-day-indicators" aria-label={`${events.length} events`}>
          {events.slice(0, 4).map((event) => (
            <span key={event.id} className="calendar-day-dot" aria-hidden />
          ))}
          {hiddenEventCount > 0 && (
            <span className="calendar-day-more">+{hiddenEventCount}</span>
          )}
        </span>
      )}

      {events.length === 0 && isCategoryLinked && (
        <span className="calendar-day-linked">已归类</span>
      )}
    </button>
  )
}
