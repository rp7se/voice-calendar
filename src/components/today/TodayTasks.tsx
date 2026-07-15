import type { CalendarEvent } from '../../types/calendar.ts'
import { getTasks, updateTask } from '../../utils/taskStorage.ts'
import {
  filterTasksByCategory,
  formatDeadline,
  formatDuration,
  getTodayPendingTasks,
} from '../tasks/taskUtils.ts'

type TodayTasksProps = {
  events: CalendarEvent[]
  selectedCategoryId?: string | null
  refreshVersion?: number
  onTasksChange?: () => void
}

function getTaskLikeEvents(events: CalendarEvent[]) {
  return events.filter((event) => event.type === 'work' || event.type === 'reminder')
}

export default function TodayTasks({
  events,
  selectedCategoryId = null,
  refreshVersion = 0,
  onTasksChange,
}: TodayTasksProps) {
  const todayTasks = getTodayPendingTasks(
    filterTasksByCategory(getTasks(), selectedCategoryId),
  )
  const taskLikeEvents = getTaskLikeEvents(events)

  const handleCompleteTask = (taskId: string) => {
    updateTask(taskId, { status: 'completed' })
    onTasksChange?.()
  }

  return (
    <section
      className="today-section today-tasks"
      aria-labelledby="today-tasks-title"
      data-refresh-version={refreshVersion}
    >
      <div className="today-section-header">
        <div>
          <span>Today Tasks</span>
          <h3 id="today-tasks-title">今日任务</h3>
        </div>
      </div>

      {todayTasks.length > 0 ? (
        <ul className="today-task-list">
          {todayTasks.map((task) => (
            <li key={task.id} className="today-task-item">
              <button
                type="button"
                className="today-task-check today-task-check--button"
                aria-label={`完成 ${task.title}`}
                onClick={() => handleCompleteTask(task.id)}
              />
              <div>
                <strong>{task.title}</strong>
                <span>
                  {formatDeadline(task)} · {formatDuration(task.estimatedDurationMinutes)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : taskLikeEvents.length === 0 ? (
        <p className="today-task-empty">今天没有到期任务。</p>
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
