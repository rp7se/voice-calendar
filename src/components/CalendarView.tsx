import { useMemo, useState, type DragEvent } from 'react'
import CalendarDayCell from './calendar/CalendarDayCell.tsx'
import CalendarHeader from './calendar/CalendarHeader.tsx'
import { filterEventsByCategory, getCategoryDateSet } from './category/categoryFilters.ts'
import type { CalendarEvent } from '../types/calendar.ts'
import { getEvents } from '../utils/storage.ts'
import { formatDate, getMonthDays, isToday } from '../utils/date.ts'
import { getHolidayByDate } from '../utils/holiday.ts'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

type CalendarViewProps = {
  selectedDate: string
  selectedCategoryId?: string | null
  selectedCategoryName?: string | null
  onSelectDate: (date: Date) => void
  eventsVersion?: number
}

function buildEventMap(categoryId: string | null): Record<string, CalendarEvent[]> {
  const eventMap: Record<string, CalendarEvent[]> = {}

  for (const event of filterEventsByCategory(getEvents(), categoryId)) {
    eventMap[event.date] = eventMap[event.date] ?? []
    eventMap[event.date].push(event)
  }

  for (const events of Object.values(eventMap)) {
    events.sort((a, b) => {
      const timeDiff = a.startTime.localeCompare(b.startTime)
      if (timeDiff !== 0) {
        return timeDiff
      }
      return a.title.localeCompare(b.title)
    })
  }

  return eventMap
}

function formatCalendarMonth(year: number, month: number): string {
  return `${year} 年 ${month + 1} 月`
}

export default function CalendarView({
  selectedDate,
  selectedCategoryId = null,
  selectedCategoryName = null,
  onSelectDate,
}: CalendarViewProps) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [draggingDate, setDraggingDate] = useState<string | null>(null)

  const monthDays = useMemo(
    () => getMonthDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  )

  const eventMap = buildEventMap(selectedCategoryId)
  const linkedDateSet = selectedCategoryId ? getCategoryDateSet(selectedCategoryId) : null

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((year) => year - 1)
      setViewMonth(11)
      return
    }
    setViewMonth((month) => month - 1)
  }

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((year) => year + 1)
      setViewMonth(0)
      return
    }
    setViewMonth((month) => month + 1)
  }

  const goToToday = () => {
    const current = new Date()
    setViewYear(current.getFullYear())
    setViewMonth(current.getMonth())
    onSelectDate(current)
  }

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    dateKey: string,
  ) => {
    setDraggingDate(dateKey)
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('text/plain', dateKey)
    event.dataTransfer.setData('application/x-voice-calendar-date', dateKey)
  }

  const handleDragEnd = () => {
    setDraggingDate(null)
  }

  return (
    <section className="calendar-view" aria-label="月历">
      <CalendarHeader
        monthLabel={formatCalendarMonth(viewYear, viewMonth)}
        selectedCategoryName={selectedCategoryName}
        onPrevMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
        onToday={goToToday}
      />

      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="calendar-weekday">
            {label}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {monthDays.map((day) => {
          const dateKey = formatDate(day.date)
          const events = eventMap[dateKey] ?? []
          const holiday = getHolidayByDate(dateKey)
          const dayIsToday = isToday(day.date)
          const dayIsSelected = dateKey === selectedDate

          return (
            <CalendarDayCell
              key={dateKey}
              day={day}
              dateKey={dateKey}
              events={events}
              holiday={holiday}
              isSelected={dayIsSelected}
              isToday={dayIsToday}
              isCategoryLinked={linkedDateSet?.has(dateKey) ?? false}
              isDragging={draggingDate === dateKey}
              onSelectDate={onSelectDate}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          )
        })}
      </div>
    </section>
  )
}
