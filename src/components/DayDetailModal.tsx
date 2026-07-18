import { useMemo, useState, type FormEvent } from 'react'
import TimeBlockPlanner from './TimeBlockPlanner.tsx'
import type {
  CalendarEvent,
  CalendarEventInput,
  EventCategory,
  EventType,
  ReminderMinutesBefore,
} from '../types/calendar.ts'
import {
  createEvent,
  deleteEvent,
  getEventErrorMessage,
  getEventsByDate,
  updateEvent,
} from '../services/eventDataSource.ts'
import {
  formatReminderLabel,
  parseReminderSelectValue,
  REMINDER_OPTIONS,
} from '../utils/reminder.ts'

type DayDetailModalProps = {
  selectedDate: string
  categories: EventCategory[]
  isOpen: boolean
  onClose: () => void
  onEventsChange?: () => void
}

const TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: 'schedule', label: '日程' },
  { value: 'course', label: '课程' },
  { value: 'work', label: '工作' },
  { value: 'reminder', label: '提醒' },
]

const TYPE_LABELS: Record<EventType, string> = {
  schedule: '日程',
  course: '课程',
  work: '工作',
  reminder: '提醒',
}

type EventFormState = {
  title: string
  description: string
  startTime: string
  endTime: string
  type: EventType
  categoryId: string
  reminderMinutesBefore: ReminderMinutesBefore
}

const EMPTY_FORM: EventFormState = {
  title: '',
  description: '',
  startTime: '',
  endTime: '',
  type: 'schedule' as EventType,
  categoryId: '',
  reminderMinutesBefore: null,
}

function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const timeDiff = a.startTime.localeCompare(b.startTime)
    if (timeDiff !== 0) {
      return timeDiff
    }
    return a.title.localeCompare(b.title)
  })
}

export default function DayDetailModal({
  selectedDate,
  categories,
  isOpen,
  onClose,
  onEventsChange,
}: DayDetailModalProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [operationError, setOperationError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [, setRefreshVersion] = useState(0)

  const refreshEvents = () => {
    setRefreshVersion((version) => version + 1)
  }

  const events = getEventsByDate(selectedDate)
  const sortedEvents = useMemo(() => sortEventsByTime(events), [events])

  const resetEditor = () => {
    setForm(EMPTY_FORM)
    setEditingEventId(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title.trim() || !form.startTime) {
      return
    }

    const eventInput: CalendarEventInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      date: selectedDate,
      startTime: form.startTime,
      endTime: form.endTime || undefined,
      type: form.type,
      categoryId: form.categoryId || undefined,
      reminderMinutesBefore: form.reminderMinutesBefore,
    }

    setIsSaving(true)
    setOperationError('')
    try {
      if (editingEventId) {
        const updated = await updateEvent(editingEventId, eventInput)
        if (!updated) {
          setOperationError('没有找到需要修改的日程。')
          return
        }
      } else {
        await createEvent(eventInput)
      }
      resetEditor()
      refreshEvents()
      onEventsChange?.()
    } catch (error) {
      setOperationError(getEventErrorMessage(error, '保存日程失败，请稍后重试。'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setOperationError('')
    try {
      const deleted = await deleteEvent(id)
      if (!deleted) {
        setOperationError('没有找到需要删除的日程。')
        return
      }
      if (editingEventId === id) {
        resetEditor()
      }
      refreshEvents()
      onEventsChange?.()
    } catch (error) {
      setOperationError(getEventErrorMessage(error, '删除日程失败，请稍后重试。'))
    }
  }

  const handleEdit = (event: CalendarEvent) => {
    setEditingEventId(event.id)
    setOperationError('')
    setForm({
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime ?? '',
      type: event.type,
      categoryId: event.categoryId ?? '',
      reminderMinutesBefore: event.reminderMinutesBefore,
    })
  }

  const handlePlannerSaved = () => {
    refreshEvents()
    onEventsChange?.()
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="day-detail-modal-overlay" onClick={onClose}>
      <section
        className="day-detail-modal"
        aria-label="日期详情"
        aria-modal="true"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="day-detail-modal-header">
          <div>
            <span className="day-detail-modal-eyebrow">日期详情</span>
            <h2>{selectedDate}</h2>
          </div>
          <button type="button" className="day-detail-modal-close" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="day-detail-modal-body">
          <section className="day-detail-modal-section">
            <div className="day-detail-modal-section-header">
              <h3>当天事项</h3>
              <span>{sortedEvents.length} 项</span>
            </div>

            {sortedEvents.length === 0 ? (
              <p className="day-detail-modal-empty">当天暂无事项，可以在下方添加。</p>
            ) : (
              <ul className="day-detail-modal-event-list">
                {sortedEvents.map((item) => (
                  <li key={item.id} className="day-detail-modal-event">
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {item.startTime}
                        {item.endTime ? ` - ${item.endTime}` : ''} · {TYPE_LABELS[item.type]}
                      </span>
                      {item.description && <p>{item.description}</p>}
                      {item.reminderMinutesBefore !== null && (
                        <span>提醒：{formatReminderLabel(item.reminderMinutesBefore)}</span>
                      )}
                    </div>
                    <div className="day-detail-modal-event-actions">
                      <button type="button" onClick={() => handleEdit(item)}>
                        编辑
                      </button>
                      <button type="button" onClick={() => void handleDelete(item.id)}>
                        删除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form className="day-detail-modal-form" onSubmit={handleSubmit}>
            <div className="day-detail-modal-form-heading">
              <h3>{editingEventId ? '编辑事项' : '添加普通事项'}</h3>
              {editingEventId && (
                <button type="button" onClick={resetEditor}>
                  取消编辑
                </button>
              )}
            </div>
            <div className="day-detail-modal-form-grid">
              <div className="form-row">
                <label htmlFor="modal-event-title">标题 *</label>
                <input
                  id="modal-event-title"
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="输入标题"
                  required
                />
              </div>
              <div className="form-row">
                <label htmlFor="modal-event-type">类型</label>
                <select
                  id="modal-event-type"
                  value={form.type}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, type: event.target.value as EventType }))
                  }
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="modal-event-start">开始时间 *</label>
                <input
                  id="modal-event-start"
                  type="time"
                  value={form.startTime}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, startTime: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="form-row">
                <label htmlFor="modal-event-end">结束时间</label>
                <input
                  id="modal-event-end"
                  type="time"
                  value={form.endTime}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, endTime: event.target.value }))
                  }
                />
              </div>
              <div className="form-row day-detail-modal-form-wide">
                <label htmlFor="modal-event-description">描述</label>
                <textarea
                  id="modal-event-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="可选描述"
                  rows={2}
                />
              </div>
              <div className="form-row">
                <label htmlFor="modal-event-category">分类</label>
                {categories.length === 0 ? (
                  <select id="modal-event-category" disabled>
                    <option>暂无分类</option>
                  </select>
                ) : (
                  <select
                    id="modal-event-category"
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
                )}
              </div>
              <div className="form-row">
                <label htmlFor="modal-event-reminder">提醒</label>
                <select
                  id="modal-event-reminder"
                  value={form.reminderMinutesBefore ?? ''}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      reminderMinutesBefore: parseReminderSelectValue(event.target.value),
                    }))
                  }
                >
                  {REMINDER_OPTIONS.map((option) => (
                    <option key={option.value ?? 'none'} value={option.value ?? ''}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {operationError && (
              <p className="event-operation-error" role="alert">
                {operationError}
              </p>
            )}
            <button
              type="submit"
              className="form-submit-btn day-detail-modal-submit"
              disabled={isSaving}
            >
              {isSaving ? '正在保存...' : editingEventId ? '保存修改' : '添加事项'}
            </button>
          </form>

          <TimeBlockPlanner selectedDate={selectedDate} onSaved={handlePlannerSaved} />
        </div>
      </section>
    </div>
  )
}
