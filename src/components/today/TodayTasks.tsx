import type { CalendarEvent } from '../../types/calendar.ts'

type TodayTasksProps = {
  events: CalendarEvent[]
}

function getTaskLikeEvents(events: CalendarEvent[]) {
  return events.filter((event) => event.type === 'work' || event.type === 'reminder')
}

export default function TodayTasks({ events }: TodayTasksProps) {
  const taskLikeEvents = getTaskLikeEvents(events)

  return (
    <section className="today-section today-tasks" aria-labelledby="today-tasks-title">
      <div className="today-section-header">
        <div>
          <span>Today Tasks</span>
          <h3 id="today-tasks-title">今日任务</h3>
        </div>
      </div>

      {taskLikeEvents.length === 0 ? (
        <p className="today-task-empty">
          当前数据模型还没有独立任务状态；这里会优先显示今日工作和提醒类日程。
        </p>
      ) : (
        <ul className="today-task-list">
          {taskLikeEvents.map((event) => (
            <li key={event.id} className="today-task-item">
              <span className="today-task-check" aria-hidden />
              <div>
                <strong>{event.title}</strong>
                <span>{event.startTime}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
