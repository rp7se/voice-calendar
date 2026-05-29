import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { CountdownItem } from '../types/calendar.ts'
import { addCountdown, deleteCountdown, getCountdowns } from '../utils/storage.ts'
import { formatCountdownLabel, getDaysBetweenToday } from '../utils/date.ts'

const EMPTY_FORM = {
  title: '',
  targetDate: '',
  description: '',
}

type CountdownPanelProps = {
  onCountdownChange?: () => void
}

function getCountdownStatus(targetDate: string): 'today' | 'future' | 'past' | 'invalid' {
  const days = getDaysBetweenToday(targetDate)
  if (days === null) {
    return 'invalid'
  }
  if (days === 0) {
    return 'today'
  }
  if (days > 0) {
    return 'future'
  }
  return 'past'
}

export default function CountdownPanel({ onCountdownChange }: CountdownPanelProps) {
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([])
  const [form, setForm] = useState(EMPTY_FORM)

  const refreshCountdowns = () => {
    setCountdowns(getCountdowns())
  }

  useEffect(() => {
    refreshCountdowns()
  }, [])

  const sortedCountdowns = useMemo(() => {
    return [...countdowns].sort((a, b) => a.targetDate.localeCompare(b.targetDate))
  }, [countdowns])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title.trim() || !form.targetDate) {
      return
    }

    addCountdown({
      title: form.title.trim(),
      targetDate: form.targetDate,
      description: form.description.trim() || undefined,
    })

    setForm(EMPTY_FORM)
    refreshCountdowns()
    onCountdownChange?.()
  }

  const handleDelete = (id: string) => {
    deleteCountdown(id)
    refreshCountdowns()
    onCountdownChange?.()
  }

  return (
    <section className="countdown-panel" aria-label="倒计时">
      <header className="countdown-panel-header">
        <h2 className="section-title">⏳ 重要事项倒计时</h2>
        <p>记录考试、比赛、面试等重要日期</p>
      </header>

      <form className="countdown-form" onSubmit={handleSubmit}>
        <h3>新增倒计时</h3>
        <div className="form-row">
          <label htmlFor="countdown-title">标题 *</label>
          <input
            id="countdown-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="例如：期末考试"
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="countdown-date">目标日期 *</label>
          <input
            id="countdown-date"
            type="date"
            value={form.targetDate}
            onChange={(e) => setForm((prev) => ({ ...prev, targetDate: e.target.value }))}
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="countdown-desc">描述</label>
          <textarea
            id="countdown-desc"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="可选备注"
            rows={2}
          />
        </div>
        <button type="submit" className="form-submit-btn">
          添加倒计时
        </button>
      </form>

      <div className="countdown-list">
        {sortedCountdowns.length === 0 ? (
          <p className="countdown-empty">暂无倒计时，可在上方添加</p>
        ) : (
          sortedCountdowns.map((item) => {
            const status = getCountdownStatus(item.targetDate)
            return (
              <article
                key={item.id}
                className={`countdown-card countdown-card--${status}`}
              >
                <div className="countdown-card-body">
                  <span className="countdown-card-emoji" aria-hidden>
                    {status === 'today' ? '🎯' : status === 'future' ? '⏳' : '📌'}
                  </span>
                  <h4 className="countdown-card-title">{item.title}</h4>
                  <p className="countdown-card-date">{item.targetDate}</p>
                  {item.description && (
                    <p className="countdown-card-desc">{item.description}</p>
                  )}
                  <p className="countdown-card-remaining">
                    {formatCountdownLabel(item.targetDate)}
                  </p>
                </div>
                <button
                  type="button"
                  className="countdown-delete-btn"
                  onClick={() => handleDelete(item.id)}
                >
                  删除
                </button>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
