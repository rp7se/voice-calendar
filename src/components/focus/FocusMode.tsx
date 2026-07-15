import { useEffect, useMemo, useState } from 'react'
import CountdownBubbleLayer from '../CountdownBubbleLayer.tsx'

type FocusModeProps = {
  countdownRefreshVersion?: number
  onExit: () => void
}

function formatFocusTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatFocusDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

export default function FocusMode({
  countdownRefreshVersion = 0,
  onExit,
}: FocusModeProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onExit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onExit])

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timerId)
  }, [])

  const timeLabel = useMemo(() => formatFocusTime(now), [now])
  const dateLabel = useMemo(() => formatFocusDate(now), [now])

  return (
    <section className="focus-mode" aria-label="沉浸专注模式">
      <header className="focus-mode-header">
        <div>
          <span>Focus Mode</span>
          <strong>专注倒计时</strong>
        </div>
        <div className="focus-mode-time" aria-label="当前时间">
          <strong>{timeLabel}</strong>
          <span>{dateLabel}</span>
        </div>
        <button type="button" className="focus-mode-exit" onClick={onExit}>
          退出专注模式
        </button>
      </header>

      <div className="focus-mode-bubble-area" aria-label="倒计时目标空间">
        <CountdownBubbleLayer refreshVersion={countdownRefreshVersion} />
      </div>
    </section>
  )
}
