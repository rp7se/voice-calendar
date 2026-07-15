import { getNextTodayEvent, getTodayEvents, formatEventTimeRange } from './todayData.ts'

type NextEventProps = {
  selectedCategoryId?: string | null
}

export default function NextEvent({ selectedCategoryId = null }: NextEventProps) {
  const events = getTodayEvents(new Date(), selectedCategoryId)
  const nextEvent = getNextTodayEvent(events)

  return (
    <section className="today-context-card next-event" aria-labelledby="next-event-title">
      <span className="today-context-kicker">Next Event</span>
      <h3 id="next-event-title">下一项日程</h3>
      {nextEvent ? (
        <article>
          <time dateTime={nextEvent.startTime}>{nextEvent.startTime}</time>
          <strong>{nextEvent.title}</strong>
          <span>{formatEventTimeRange(nextEvent)}</span>
          {nextEvent.description && <p>{nextEvent.description}</p>}
        </article>
      ) : (
        <p>今天没有更多安排。</p>
      )}
    </section>
  )
}
