import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react'
import type { CalendarEvent, EventCategory, EventType } from '../types/calendar.ts'
import {
  addCategory,
  addDateToCategory,
  deleteCategory,
  getCategories,
  getCategoryDateLinks,
  getDatesByCategory,
  getEvents,
  getEventsByCategory,
  getEventsByDate,
  removeDateFromCategory,
} from '../utils/storage.ts'

type CategoryPanelProps = {
  eventsVersion?: number
  onCategoriesChange?: () => void
}

const TYPE_LABELS: Record<EventType, string> = {
  schedule: '日程',
  course: '课程',
  work: '工作',
  reminder: '提醒',
}

const EMPTY_FORM = {
  name: '',
  description: '',
}

function buildCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const event of getEvents()) {
    if (event.categoryId) {
      counts[event.categoryId] = (counts[event.categoryId] ?? 0) + 1
    }
  }
  return counts
}

function buildCategoryDateCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const link of getCategoryDateLinks()) {
    counts[link.categoryId] = (counts[link.categoryId] ?? 0) + 1
  }
  return counts
}

function getDraggedDate(event: DragEvent<HTMLElement>): string {
  return (
    event.dataTransfer.getData('application/x-voice-calendar-date') ||
    event.dataTransfer.getData('text/plain')
  )
}

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
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

export default function CategoryPanel({
  eventsVersion = 0,
  onCategoriesChange,
}: CategoryPanelProps) {
  const [categories, setCategories] = useState<EventCategory[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [categoryEvents, setCategoryEvents] = useState<CalendarEvent[]>([])
  const [categoryDates, setCategoryDates] = useState<string[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null)
  const [dropFeedback, setDropFeedback] = useState('')
  const [dateLinksVersion, setDateLinksVersion] = useState(0)

  const refreshCategories = () => {
    const list = getCategories()
    setCategories(list)
    if (selectedCategoryId && !list.some((item) => item.id === selectedCategoryId)) {
      setSelectedCategoryId(null)
      setCategoryEvents([])
      setCategoryDates([])
    }
  }

  const refreshCategoryDetails = (categoryId: string | null) => {
    if (!categoryId) {
      setCategoryEvents([])
      setCategoryDates([])
      return
    }
    setCategoryEvents(getEventsByCategory(categoryId))
    setCategoryDates(getDatesByCategory(categoryId))
  }

  useEffect(() => {
    refreshCategories()
  }, [eventsVersion, dateLinksVersion])

  useEffect(() => {
    refreshCategoryDetails(selectedCategoryId)
  }, [selectedCategoryId, eventsVersion, dateLinksVersion])

  const categoryCounts = useMemo(
    () => buildCategoryCounts(),
    [categories, eventsVersion],
  )

  const categoryDateCounts = useMemo(
    () => buildCategoryDateCounts(),
    [categories, dateLinksVersion],
  )

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) {
      return
    }

    addCategory({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
    })

    setForm(EMPTY_FORM)
    refreshCategories()
    onCategoriesChange?.()
  }

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId)
  }

  const handleDeleteCategory = (categoryId: string) => {
    deleteCategory(categoryId)
    if (selectedCategoryId === categoryId) {
      setSelectedCategoryId(null)
      setCategoryEvents([])
      setCategoryDates([])
    }
    refreshCategories()
    setDateLinksVersion((version) => version + 1)
    onCategoriesChange?.()
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>, categoryId: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragOverCategoryId(categoryId)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>, category: EventCategory) => {
    event.preventDefault()
    setDragOverCategoryId(null)

    const date = getDraggedDate(event)
    if (!isValidDateKey(date)) {
      return
    }

    const alreadyLinked = getDatesByCategory(category.id).includes(date)
    addDateToCategory(category.id, date)
    setSelectedCategoryId(category.id)
    setDropFeedback(
      alreadyLinked
        ? `${date} 已经在 ${category.name} 分类中了`
        : `已将 ${date} 加入 ${category.name}`,
    )
    setDateLinksVersion((version) => version + 1)
    onCategoriesChange?.()
  }

  const handleRemoveDate = (date: string) => {
    if (!selectedCategoryId) {
      return
    }
    removeDateFromCategory(selectedCategoryId, date)
    setDateLinksVersion((version) => version + 1)
    onCategoriesChange?.()
  }

  return (
    <section className="category-panel" aria-label="分类">
      <header className="category-panel-header">
        <h2 className="section-title">分类</h2>
      </header>

      <form className="category-form" onSubmit={handleSubmit}>
        <h3 className="sidebar-form-title">新建</h3>
        <div className="form-row">
          <label htmlFor="category-name">名称 *</label>
          <input
            id="category-name"
            type="text"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="例如：学习"
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="category-desc">描述</label>
          <textarea
            id="category-desc"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="可选描述"
            rows={2}
          />
        </div>
        <button type="submit" className="form-submit-btn">
          创建分类
        </button>
      </form>

      {dropFeedback && <p className="category-drop-feedback">{dropFeedback}</p>}

      <div className="category-folders">
        {categories.length === 0 ? (
          <p className="category-empty">暂无分类，可在上方创建。</p>
        ) : (
          categories.map((category) => {
            const count = categoryCounts[category.id] ?? 0
            const dateCount = categoryDateCounts[category.id] ?? 0
            const isSelected = selectedCategoryId === category.id
            const isDragOver = dragOverCategoryId === category.id
            return (
              <div
                key={category.id}
                className={[
                  'category-folder',
                  isSelected && 'category-folder--selected',
                  isDragOver && 'category-folder--drag-over',
                  isDragOver && 'category-card--drag-over',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onDragOver={(event) => handleDragOver(event, category.id)}
                onDragLeave={() => setDragOverCategoryId(null)}
                onDrop={(event) => handleDrop(event, category)}
              >
                <button
                  type="button"
                  className="category-folder-select"
                  onClick={() => handleSelectCategory(category.id)}
                >
                  <span className="category-folder-icon" aria-hidden>
                    <span className="category-mark" />
                  </span>
                  <span className="category-folder-main">
                    <span className="category-folder-name">{category.name}</span>
                    {category.description && (
                      <span className="category-folder-desc">{category.description}</span>
                    )}
                    <span className="category-folder-counts">
                      {count} 项事项 · {dateCount} 个日期
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="category-delete-btn"
                  onClick={() => handleDeleteCategory(category.id)}
                >
                  删除
                </button>
              </div>
            )
          })
        )}
      </div>

      {selectedCategory && (
        <div className="category-events">
          <h3 className="category-events-title">{selectedCategory.name} · 事项列表</h3>
          {categoryEvents.length === 0 ? (
            <p className="category-events-empty">该分类下暂无事项</p>
          ) : (
            <ul className="category-event-list">
              {categoryEvents.map((item) => (
                <li key={item.id} className="category-event-card">
                  <strong>{item.title}</strong>
                  <span className="category-event-meta">
                    {item.date} · {item.startTime}
                    {item.endTime ? ` - ${item.endTime}` : ''}
                  </span>
                  <span className="category-event-type">{TYPE_LABELS[item.type]}</span>
                  {item.description && (
                    <p className="category-event-desc">{item.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="category-linked-dates">
            <h3 className="category-events-title">已加入的日期</h3>
            {categoryDates.length === 0 ? (
              <p className="category-events-empty">把日历日期拖到分类，即可加入这里。</p>
            ) : (
              <ul className="category-date-list">
                {categoryDates.map((date) => {
                  const dateEvents = sortEventsByTime(getEventsByDate(date))
                  const previewTitles = dateEvents
                    .slice(0, 3)
                    .map((event) => event.title)
                    .join('、')
                  return (
                    <li key={date} className="category-date-card">
                      <div>
                        <strong>{date}</strong>
                        <span>{dateEvents.length} 项日程</span>
                        <p>{previewTitles || '当天暂无日程'}</p>
                      </div>
                      <button type="button" onClick={() => handleRemoveDate(date)}>
                        移除
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
