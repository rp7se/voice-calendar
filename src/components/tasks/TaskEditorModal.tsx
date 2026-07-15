import { useState, type FormEvent } from 'react'
import type { EventCategory } from '../../types/calendar.ts'
import type { Task, TaskInput, TaskPriority } from '../../types/task.ts'

type TaskEditorModalProps = {
  task?: Task | null
  categories: EventCategory[]
  defaultCategoryId?: string | null
  onSave: (task: TaskInput, taskId?: string) => void
  onClose: () => void
}

const DURATION_OPTIONS = [
  { value: '', label: '不设置' },
  { value: '30', label: '30 分钟' },
  { value: '60', label: '1 小时' },
  { value: '90', label: '1 小时 30 分钟' },
  { value: '120', label: '2 小时' },
  { value: '180', label: '3 小时' },
]

function buildInitialForm(
  task: Task | null | undefined,
  defaultCategoryId: string | null | undefined,
) {
  return {
    title: task?.title ?? '',
    priority: task?.priority ?? 'medium',
    deadlineDate: task?.deadlineDate ?? '',
    deadlineTime: task?.deadlineTime ?? '',
    estimatedDurationMinutes: task?.estimatedDurationMinutes
      ? String(task.estimatedDurationMinutes)
      : '',
    categoryId: task?.categoryId ?? defaultCategoryId ?? '',
  }
}

export default function TaskEditorModal({
  task,
  categories,
  defaultCategoryId = null,
  onSave,
  onClose,
}: TaskEditorModalProps) {
  const [form, setForm] = useState(() => buildInitialForm(task, defaultCategoryId))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = form.title.trim()
    if (!title) {
      return
    }

    onSave(
      {
        title,
        status: task?.status ?? 'pending',
        priority: form.priority as TaskPriority,
        deadlineDate: form.deadlineDate || undefined,
        deadlineTime: form.deadlineTime || undefined,
        estimatedDurationMinutes: form.estimatedDurationMinutes
          ? Number(form.estimatedDurationMinutes)
          : undefined,
        categoryId: form.categoryId || undefined,
      },
      task?.id,
    )
  }

  return (
    <div className="task-editor-overlay" onClick={onClose}>
      <section
        className="task-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-label={task ? '编辑任务' : '新建任务'}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="task-editor-header">
          <div>
            <span>Task Detail</span>
            <h2>{task ? '编辑任务' : '新建任务'}</h2>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <form className="task-editor-form" onSubmit={handleSubmit}>
          <div className="form-row task-editor-wide">
            <label htmlFor="task-title">任务名称 *</label>
            <input
              id="task-title"
              type="text"
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="例如：完成 C++ 调度接口设计"
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="task-priority">优先级</label>
            <select
              id="task-priority"
              value={form.priority}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  priority: event.target.value as TaskPriority,
                }))
              }
            >
              <option value="high">高优先级</option>
              <option value="medium">中优先级</option>
              <option value="low">低优先级</option>
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="task-duration">预计耗时</label>
            <select
              id="task-duration"
              value={form.estimatedDurationMinutes}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  estimatedDurationMinutes: event.target.value,
                }))
              }
            >
              {DURATION_OPTIONS.map((option) => (
                <option key={option.value || 'none'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="task-deadline-date">截止日期</label>
            <input
              id="task-deadline-date"
              type="date"
              value={form.deadlineDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, deadlineDate: event.target.value }))
              }
            />
          </div>

          <div className="form-row">
            <label htmlFor="task-deadline-time">截止时间</label>
            <input
              id="task-deadline-time"
              type="time"
              value={form.deadlineTime}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, deadlineTime: event.target.value }))
              }
            />
          </div>

          <div className="form-row task-editor-wide">
            <label htmlFor="task-category">分类</label>
            <select
              id="task-category"
              value={form.categoryId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, categoryId: event.target.value }))
              }
            >
              <option value="">不选择分类</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="task-editor-submit">
            {task ? '保存任务' : '创建任务'}
          </button>
        </form>
      </section>
    </div>
  )
}
