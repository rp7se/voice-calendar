import { useMemo, useState, type FormEvent } from 'react'
import type {
  CalendarEvent,
  EventCategory,
  EventType,
  ReminderMinutesBefore,
} from '../types/calendar.ts'
import {
  createEvent,
  deleteEvent,
  getEventErrorMessage,
  getEventsByDate,
} from '../services/eventDataSource.ts'
import {
  formatReminderLabel,
  parseReminderSelectValue,
  REMINDER_OPTIONS,
} from '../utils/reminder.ts'

type DayDetailProps = {
  selectedDate: string
  categories: EventCategory[]
  onEventsChange?: () => void
  compact?: boolean
}

const TYPE_GROUPS: { type: EventType; label: string }[] = [
  { type: 'schedule', label: '日程' },
  { type: 'course', label: '课程' },
  { type: 'work', label: '工作' },
  { type: 'reminder', label: '提醒' },
]

const TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: 'schedule', label: '日程' },
  { value: 'course', label: '课程' },
  { value: 'work', label: '工作' },
  { value: 'reminder', label: '提醒' },
]

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

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function calculateTotalDurationMinutes(events: CalendarEvent[]): number {
  return events.reduce((total, event) => {
    if (!event.endTime) {
      return total
    }
    const start = parseTimeToMinutes(event.startTime)
    const end = parseTimeToMinutes(event.endTime)
    if (end <= start) {
      return total
    }
    return total + (end - start)
  }, 0)
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) {
    return `${hours} 小时 ${mins} 分钟`
  }
  if (hours > 0) {
    return `${hours} 小时`
  }
  return `${mins} 分钟`
}

export default function DayDetail({
  selectedDate,
  categories,
  onEventsChange,
  compact = false,
}: DayDetailProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [operationError, setOperationError] = useState('')
  const [, setRefreshVersion] = useState(0)

  const refreshEvents = () => {
    setRefreshVersion((version) => version + 1)
  }

  const events = getEventsByDate(selectedDate)
  const groupedEvents = useMemo(() => {
    return TYPE_GROUPS.map((group) => ({
      ...group,
      items: events.filter((event) => event.type === group.type),
    }))
  }, [events])

  const totalDurationMinutes = useMemo(
    () => calculateTotalDurationMinutes(events),
    [events],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title.trim() || !form.startTime) {
      return
    }

    setOperationError('')
    try {
      await createEvent({
        title: form.title.trim(),
        description: form.description.trim(),
        date: selectedDate,
        startTime: form.startTime,
        endTime: form.endTime || undefined,
        type: form.type,
        categoryId: form.categoryId || undefined,
        reminderMinutesBefore: form.reminderMinutesBefore,
      })
      setForm(EMPTY_FORM)
      refreshEvents()
      onEventsChange?.()
    } catch (error) {
      setOperationError(getEventErrorMessage(error, '保存日程失败，请稍后重试。'))
    }
  }

  const handleDelete = async (id: string) => {
    setOperationError('')
    try {
      const deleted = await deleteEvent(id)
      if (deleted) {
        refreshEvents()
        onEventsChange?.()
      }
    } catch (error) {
      setOperationError(getEventErrorMessage(error, '删除日程失败，请稍后重试。'))
    }
  }

  const hasEvents = events.length > 0

  return (
    <section
      className={`day-detail${compact ? ' day-detail--compact' : ''}`}
      aria-label="当日详情"
    >
      <header className="day-detail-header">
        <h2 className="day-detail-title">📝 {selectedDate}</h2>
        <p className="day-detail-summary">
          共 {events.length} 项
          {totalDurationMinutes > 0 && (
            <span> · 预计耗时 {formatDuration(totalDurationMinutes)}</span>
          )}
        </p>
      </header>

      <form className="day-detail-form" onSubmit={handleSubmit}>
        <h3 className="sidebar-form-title">添加事项</h3>
        <div className="form-row">
          <label htmlFor="event-title">标题 *</label>
          <input
            id="event-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="输入标题"
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="event-description">描述</label>
          <textarea
            id="event-description"
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="可选描述"
            rows={2}
          />
        </div>
        <div className="form-row form-row--inline">
          <div>
            <label htmlFor="event-start">开始时间 *</label>
            <input
              id="event-start"
              type="time"
              value={form.startTime}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, startTime: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label htmlFor="event-end">结束时间</label>
            <input
              id="event-end"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
            />
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="event-type">类型</label>
          <select
            id="event-type"
            value={form.type}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, type: e.target.value as EventType }))
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
          <label htmlFor="event-category">分类</label>
          {categories.length === 0 ? (
            <select id="event-category" disabled>
              <option>暂无分类</option>
            </select>
          ) : (
            <select
              id="event-category"
              value={form.categoryId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, categoryId: e.target.value }))
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
          <label htmlFor="event-reminder">提醒</label>
          <select
            id="event-reminder"
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
        {operationError && (
          <p className="event-operation-error" role="alert">
            {operationError}
          </p>
        )}
        <button type="submit" className="form-submit-btn">
          添加
        </button>
      </form>

      <div className="day-detail-events">
        {!hasEvents && <p className="day-detail-empty">当天暂无事项，可上方手动添加</p>}

        {groupedEvents.map((group) =>
          group.items.length > 0 ? (
            <div key={group.type} className="event-group">
              <h3 className="event-group-title">{group.label}</h3>
              <ul className="event-list">
                {group.items.map((item) => (
                  <li key={item.id} className="event-card">
                    <div className="event-card-main">
                      <strong>{item.title}</strong>
                      <span className="event-card-time">
                        {item.startTime}
                        {item.endTime ? ` - ${item.endTime}` : ''}
                      </span>
                      {item.description && (
                        <p className="event-card-desc">{item.description}</p>
                      )}
                      {item.reminderMinutesBefore !== null && (
                        <span className="event-card-badge">
                          提醒：{formatReminderLabel(item.reminderMinutesBefore)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="event-delete-btn"
                      onClick={() => void handleDelete(item.id)}
                    >
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </div>
    </section>
  )
}
