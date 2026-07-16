import type { EventCategory } from '../../types/calendar.ts'
import type { Task } from '../../types/task.ts'
import {
  formatDeadline,
  formatDuration,
  PRIORITY_LABELS,
} from './taskUtils.ts'

type TaskListProps = {
  tasks: Task[]
  categories: EventCategory[]
  onToggleTask: (task: Task) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
}

function getCategoryName(categories: EventCategory[], categoryId?: string): string {
  if (!categoryId) {
    return '未分类'
  }
  return categories.find((category) => category.id === categoryId)?.name ?? '未分类'
}

export default function TaskList({
  tasks,
  categories,
  onToggleTask,
  onEditTask,
  onDeleteTask,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="tasks-empty-state">
        <h3>这里暂时没有任务</h3>
        <p>新建一个任务，设置截止时间和预计耗时，让它进入你的工作队列。</p>
      </div>
    )
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li
          key={task.id}
          className={`task-item task-item--${task.priority}${
            task.status === 'completed' ? ' task-item--completed' : ''
          }`}
        >
          <button
            type="button"
            className="task-complete-toggle"
            aria-label={task.status === 'completed' ? '标记为未完成' : '标记为完成'}
            onClick={() => onToggleTask(task)}
          >
            <span aria-hidden />
          </button>

          <button
            type="button"
            className="task-item-main"
            onClick={() => onEditTask(task)}
          >
            <strong>{task.title}</strong>
            <span className="task-item-meta">
              <span className="task-priority">{PRIORITY_LABELS[task.priority]}</span>
              <span>{formatDeadline(task)}</span>
              <span>{formatDuration(task.estimatedDurationMinutes)}</span>
              <span>{getCategoryName(categories, task.categoryId)}</span>
              {task.schedulingStatus === 'scheduled' && (
                <span className="task-scheduling-status">已安排</span>
              )}
            </span>
          </button>

          <button
            type="button"
            className="task-delete-btn"
            onClick={() => onDeleteTask(task.id)}
          >
            删除
          </button>
        </li>
      ))}
    </ul>
  )
}
