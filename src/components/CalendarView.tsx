import { useMemo, useState } from 'react'
import { getEvents } from '../utils/storage.ts'
import {
  formatDate,
  formatYearMonth,
  getMonthDays,
  isSameDate,
  isToday,
} from '../utils/date.ts'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function buildEventCountMap(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const event of getEvents()) {
    counts[event.date] = (counts[event.date] ?? 0) + 1
  }
  return counts
}

export default function CalendarView() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(today)

  const monthDays = useMemo(
    () => getMonthDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  )

  const eventCounts = useMemo(
    () => buildEventCountMap(),
    [viewYear, viewMonth],
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

  return (
    <section className="calendar-view" aria-label="月历">
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
          const dayIsToday = isToday(day.date)
          const dayIsSelected = isSameDate(day.date, selectedDate)

          return (
            <button
              key={dateKey}
              type="button"
              className={[
                'calendar-day',
                !day.isCurrentMonth && 'calendar-day--muted',
                dayIsToday && 'calendar-day--today',
                dayIsSelected && 'calendar-day--selected',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSelectedDate(day.date)}
            >
              <span className="calendar-day-number">{day.day}</span>
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
