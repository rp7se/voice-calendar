import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { CalendarEvent, EventCategory, EventType } from '../types/calendar.ts'
import {
  addCategory,
  deleteCategory,
  getCategories,
  getEvents,
  getEventsByCategory,
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

export default function CategoryPanel({
  eventsVersion = 0,
  onCategoriesChange,
}: CategoryPanelProps) {
  const [categories, setCategories] = useState<EventCategory[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [categoryEvents, setCategoryEvents] = useState<CalendarEvent[]>([])
  const [form, setForm] = useState(EMPTY_FORM)

  const refreshCategories = () => {
    const list = getCategories()
    setCategories(list)
    if (selectedCategoryId && !list.some((item) => item.id === selectedCategoryId)) {
      setSelectedCategoryId(null)
      setCategoryEvents([])
    }
  }

  const refreshCategoryEvents = (categoryId: string | null) => {
    if (!categoryId) {
      setCategoryEvents([])
      return
    }
    setCategoryEvents(getEventsByCategory(categoryId))
  }

  useEffect(() => {
    refreshCategories()
  }, [eventsVersion])

  useEffect(() => {
    refreshCategoryEvents(selectedCategoryId)
  }, [selectedCategoryId, eventsVersion])

  const categoryCounts = useMemo(() => buildCategoryCounts(), [categories, eventsVersion])

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
    }
    refreshCategories()
    onCategoriesChange?.()
  }

  return (
    <section className="category-panel" aria-label="分类文件夹">
      <header className="category-panel-header">
        <h2 className="section-title">📁 分类</h2>
      </header>

      <form className="category-form" onSubmit={handleSubmit}>
        <h3 className="sidebar-form-title">新建</h3>
        <div className="form-row">
          <label htmlFor="category-name">名称 *</label>
          <input
            id="category-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="例如：学习"
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="category-desc">描述</label>
          <textarea
            id="category-desc"
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="可选描述"
            rows={2}
          />
        </div>
        <button type="submit" className="form-submit-btn">
          创建分类
        </button>
      </form>

      <div className="category-folders">
        {categories.length === 0 ? (
          <p className="category-empty">暂无分类，可在上方创建</p>
        ) : (
          categories.map((category) => {
            const count = categoryCounts[category.id] ?? 0
            const isSelected = selectedCategoryId === category.id
            return (
              <div
                key={category.id}
                className={`category-folder ${isSelected ? 'category-folder--selected' : ''}`}
              >
                <button
                  type="button"
                  className="category-folder-select"
                  onClick={() => handleSelectCategory(category.id)}
                >
                  <span className="category-folder-icon" aria-hidden>
                    📁
                  </span>
                  <span className="category-folder-name">{category.name}</span>
                  {category.description && (
                    <span className="category-folder-desc">{category.description}</span>
                  )}
                  <span className="category-folder-count">{count} 项事项</span>
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
        </div>
      )}
    </section>
  )
}
