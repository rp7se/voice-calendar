import DailyTimeline from './DailyTimeline.tsx'
import TodayTasks from './TodayTasks.tsx'
import { getTodayEvents } from './todayData.ts'

type TodayWorkspaceProps = {
  selectedCategoryId?: string | null
  selectedCategoryName?: string | null
  onOpenCalendar: () => void
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})

function getGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) {
    return '早上好'
  }
  if (hour < 18) {
    return '下午好'
  }
  return '晚上好'
}

export default function TodayWorkspace({
  selectedCategoryId = null,
  selectedCategoryName = null,
  onOpenCalendar,
}: TodayWorkspaceProps) {
  const now = new Date()
  const todayEvents = getTodayEvents(now, selectedCategoryId)
  const arrangementText =
    todayEvents.length === 0
      ? '今天还没有安排，可以放松一下。'
      : `今天还有 ${todayEvents.length} 项安排。`

  return (
    <div className="today-workspace">
      <header className="today-header">
        <span>Today</span>
        <h2>{WEEKDAY_FORMATTER.format(now)}</h2>
        <p>
          {getGreeting(now)} · {arrangementText}
        </p>
        {selectedCategoryName && (
          <span className="workspace-filter-note">当前视图：{selectedCategoryName}</span>
        )}
      </header>

      <DailyTimeline events={todayEvents} onOpenCalendar={onOpenCalendar} />
      <TodayTasks events={todayEvents} />
    </div>
  )
}
