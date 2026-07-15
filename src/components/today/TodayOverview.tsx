import { getNextTodayEvent, getTodayEvents } from './todayData.ts'

type TodayOverviewProps = {
  selectedCategoryId?: string | null
}

export default function TodayOverview({
  selectedCategoryId = null,
}: TodayOverviewProps) {
  const events = getTodayEvents(new Date(), selectedCategoryId)
  const nextEvent = getNextTodayEvent(events)
  const completedCount = events.filter((event) => {
    if (!event.endTime) {
      return false
    }
    const [hour, minute] = event.endTime.split(':').map(Number)
    const now = new Date()
    return Number.isFinite(hour) && Number.isFinite(minute)
      ? hour * 60 + minute < now.getHours() * 60 + now.getMinutes()
      : false
  }).length
  const pendingCount = Math.max(events.length - completedCount, 0)

  return (
    <section className="today-context-card today-overview" aria-labelledby="today-overview-title">
      <span className="today-context-kicker">Today Overview</span>
      <h3 id="today-overview-title">今日概览</h3>
      <dl>
        <div>
          <dt>日程</dt>
          <dd>{events.length}</dd>
        </div>
        <div>
          <dt>已结束</dt>
          <dd>{completedCount}</dd>
        </div>
        <div>
          <dt>待处理</dt>
          <dd>{pendingCount}</dd>
        </div>
      </dl>
      <p>{nextEvent ? `下一项：${nextEvent.title}` : '今天没有更多安排。'}</p>
    </section>
  )
}
