import type { CalendarEvent } from '../../types/calendar.ts'
import { formatEventTimeRange, isEventActiveNow } from './todayData.ts'

type DailyTimelineProps = {
  events: CalendarEvent[]
  onOpenCalendar: () => void
}

const EVENT_TYPE_LABELS: Record<CalendarEvent['type'], string> = {
  schedule: '日程',
  course: '课程',
  work: '工作',
  reminder: '提醒',
}

export default function DailyTimeline({ events, onOpenCalendar }: DailyTimelineProps) {
  return (
    <section className="today-section today-timeline" aria-labelledby="today-timeline-title">
      <div className="today-section-header">
        <div>
          <span>Daily Timeline</span>
          <h3 id="today-timeline-title">今日时间线</h3>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="today-empty-state">
          <h4>今天还没有安排</h4>
          <p>可以通过日历或语音快速添加日程。</p>
          <button type="button" onClick={onOpenCalendar}>
            打开 Calendar
          </button>
        </div>
      ) : (
        <ol className="timeline-list">
          {events.map((event) => {
            const isActive = isEventActiveNow(event)
            return (
              <li
                key={event.id}
                className={`timeline-item${isActive ? ' timeline-item--active' : ''}`}
              >
                <time className="timeline-time" dateTime={event.startTime}>
                  {event.startTime}
                </time>
                <span className="timeline-node" aria-hidden />
                <article className="timeline-event">
                  <div className="timeline-event-main">
                    <h4>{event.title}</h4>
                    <span>{formatEventTimeRange(event)}</span>
                  </div>
                  <span className="timeline-event-type">{EVENT_TYPE_LABELS[event.type]}</span>
                  {event.description && <p>{event.description}</p>}
                  {isActive && <strong className="timeline-now">Current Time</strong>}
                </article>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
