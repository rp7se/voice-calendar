import type { CalendarEvent } from '../../types/calendar.ts'
import { useState } from 'react'
import type { Task, TaskInput } from '../../types/task.ts'
import {
  filterTasksByCategory,
  formatDeadline,
  formatDuration,
  getTodayPendingTasks,
} from '../tasks/taskUtils.ts'

type TodayTasksProps = {
  events: CalendarEvent[]
  tasks: Task[]
  selectedCategoryId?: string | null
  onUpdateTask: (id: string, input: TaskInput) => Promise<void>
}

function getTaskLikeEvents(events: CalendarEvent[]) {
  return events.filter((event) => event.type === 'work' || event.type === 'reminder')
}

export default function TodayTasks({
  events,
  tasks,
  selectedCategoryId = null,
  onUpdateTask,
}: TodayTasksProps) {
  const [operationError, setOperationError] = useState('')
  const todayTasks = getTodayPendingTasks(
    filterTasksByCategory(tasks, selectedCategoryId),
  )
  const taskLikeEvents = getTaskLikeEvents(events)

  const handleCompleteTask = async (task: Task) => {
    setOperationError('')
    try {
      await onUpdateTask(task.id, { ...task, status: 'completed' })
    } catch {
      setOperationError('任务状态更新失败，原状态已保留。')
    }
  }

  return (
    <section
      className="today-section today-tasks"
      aria-labelledby="today-tasks-title"
    >
      <div className="today-section-header">
        <div>
          <span>Today Tasks</span>
          <h3 id="today-tasks-title">今日任务</h3>
        </div>
      </div>

      {operationError && <p className="task-operation-error" role="alert">{operationError}</p>}

      {todayTasks.length > 0 ? (
        <ul className="today-task-list">
          {todayTasks.map((task) => (
            <li key={task.id} className="today-task-item">
              <button
                type="button"
                className="today-task-check today-task-check--button"
                aria-label={`完成 ${task.title}`}
                onClick={() => void handleCompleteTask(task)}
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
