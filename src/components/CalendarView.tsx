import { useMemo, useState, type DragEvent } from 'react'
import { getEvents } from '../utils/storage.ts'
import {
  formatDate,
  formatYearMonth,
  getMonthDays,
  isToday,
} from '../utils/date.ts'
import { getHolidayByDate } from '../utils/holiday.ts'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

type CalendarViewProps = {
  selectedDate: string
  onSelectDate: (date: Date) => void
  eventsVersion?: number
}

function buildEventCountMap(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const event of getEvents()) {
    counts[event.date] = (counts[event.date] ?? 0) + 1
  }
  return counts
}

export default function CalendarView({
  selectedDate,
  onSelectDate,
  eventsVersion = 0,
}: CalendarViewProps) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [draggingDate, setDraggingDate] = useState<string | null>(null)

  const monthDays = useMemo(
    () => getMonthDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  )

  const eventCounts = useMemo(
    () => buildEventCountMap(),
    [viewYear, viewMonth, eventsVersion],
  )

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
      <header className="section-header">
        <h2 className="section-title">日历</h2>
      </header>
      <div className="calendar-toolbar">
        <button type="button" className="calendar-nav-btn" onClick={goToPrevMonth}>
          上个月
        </button>
        <h2 className="calendar-title">{formatYearMonth(viewYear, viewMonth)}</h2>
        <button type="button" className="calendar-nav-btn" onClick={goToNextMonth}>
          下个月
        </button>
      </div>

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
          const eventCount = eventCounts[dateKey] ?? 0
          const holiday = getHolidayByDate(dateKey)
          const dayIsToday = isToday(day.date)
          const dayIsSelected = dateKey === selectedDate

          return (
            <button
              key={dateKey}
              type="button"
              draggable={true}
              className={[
                'calendar-day',
                !day.isCurrentMonth && 'calendar-day--muted',
                dayIsToday && 'calendar-day--today',
                dayIsSelected && 'calendar-day--selected',
                draggingDate === dateKey && 'calendar-day--dragging',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDate(day.date)}
              onDragStart={(event) => handleDragStart(event, dateKey)}
              onDragEnd={handleDragEnd}
            >
              <span className="calendar-day-number">{day.day}</span>
              {holiday && (
                <span className={`calendar-day-holiday calendar-day-holiday--${holiday.type}`}>
                  {holiday.name}
                </span>
              )}
              {eventCount > 0 && (
                <span className="calendar-day-events">
                  <span className="calendar-day-dot" aria-hidden />
                  {eventCount} 项日程
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
