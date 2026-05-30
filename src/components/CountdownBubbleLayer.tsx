import { useEffect, useRef, useState } from 'react'
import type { CountdownItem } from '../types/calendar.ts'
import { getCountdowns } from '../utils/storage.ts'
import { formatCountdownLabel, formatCountdownSpeech } from '../utils/date.ts'

type CountdownBubbleLayerProps = {
  refreshVersion?: number
}

type BubblePhysics = {
  id: string
  title: string
  targetDate: string
  x: number
  y: number
  vx: number
  vy: number
}

const BUBBLE_SIZE = 104
const MIN_GAP = 16
const SPEED = 0.22

function speakCountdown(title: string, targetDate: string): void {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }
    const utterance = new SpeechSynthesisUtterance(formatCountdownSpeech(title, targetDate))
    utterance.lang = 'zh-CN'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  } catch {
    // 浏览器不支持或播报失败时静默降级
  }
}

function createInitialBubbles(
  items: CountdownItem[],
  viewportWidth: number,
  viewportHeight: number,
): BubblePhysics[] {
  const maxX = Math.max(MIN_GAP, viewportWidth - BUBBLE_SIZE - MIN_GAP)
  const maxY = Math.max(MIN_GAP, viewportHeight - BUBBLE_SIZE - MIN_GAP)

  return items.map((item, index) => {
    const angle = (index * 1.7 + 0.5) % (Math.PI * 2)
    const column = index % 4
    const row = Math.floor(index / 4)
    const x = Math.min(MIN_GAP + column * (BUBBLE_SIZE + 28), maxX)
    const y = Math.min(MIN_GAP + row * (BUBBLE_SIZE + 28), maxY)

    return {
      id: item.id,
      title: item.title,
      targetDate: item.targetDate,
      x,
      y,
      vx: Math.cos(angle) * SPEED,
      vy: Math.sin(angle) * SPEED,
    }
  })
}

export default function CountdownBubbleLayer({
  refreshVersion = 0,
}: CountdownBubbleLayerProps) {
  const [bubbles, setBubbles] = useState<BubblePhysics[]>([])
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([])
  const [pausedBubbleId, setPausedBubbleId] = useState<string | null>(null)
  const pausedBubbleIdRef = useRef<string | null>(null)

  useEffect(() => {
    setCountdowns(getCountdowns())
  }, [refreshVersion])

  useEffect(() => {
    if (countdowns.length === 0) {
      setBubbles([])
      return
    }

    let physics = createInitialBubbles(countdowns, window.innerWidth, window.innerHeight)

    let animationId = 0

    const tick = () => {
      const maxX = Math.max(MIN_GAP, window.innerWidth - BUBBLE_SIZE - MIN_GAP)
      const maxY = Math.max(MIN_GAP, window.innerHeight - BUBBLE_SIZE - MIN_GAP)
      const currentPausedBubbleId = pausedBubbleIdRef.current

      for (const bubble of physics) {
        if (bubble.id === currentPausedBubbleId) {
          continue
        }

        let nextX = bubble.x + bubble.vx
        let nextY = bubble.y + bubble.vy

        if (nextX <= MIN_GAP) {
          nextX = MIN_GAP
          bubble.vx = Math.abs(bubble.vx)
        } else if (nextX >= maxX) {
          nextX = maxX
          bubble.vx = -Math.abs(bubble.vx)
        }

        if (nextY <= MIN_GAP) {
          nextY = MIN_GAP
          bubble.vy = Math.abs(bubble.vy)
        } else if (nextY >= maxY) {
          nextY = maxY
          bubble.vy = -Math.abs(bubble.vy)
        }

        bubble.x = nextX
        bubble.y = nextY
      }

      setBubbles(physics.map((bubble) => ({ ...bubble })))
      animationId = window.requestAnimationFrame(tick)
    }

    setBubbles(physics)
    animationId = window.requestAnimationFrame(tick)

    const handleResize = () => {
      const maxX = Math.max(MIN_GAP, window.innerWidth - BUBBLE_SIZE - MIN_GAP)
      const maxY = Math.max(MIN_GAP, window.innerHeight - BUBBLE_SIZE - MIN_GAP)
      physics = physics.map((bubble) => ({
        ...bubble,
        x: Math.min(Math.max(bubble.x, MIN_GAP), maxX),
        y: Math.min(Math.max(bubble.y, MIN_GAP), maxY),
      }))
      setBubbles(physics.map((bubble) => ({ ...bubble })))
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [countdowns])

  if (countdowns.length === 0) {
    return null
  }

  return (
    <div className="countdown-bubble-layer" aria-label="倒计时气泡提醒">
      {bubbles.map((bubble) => (
        <button
          key={bubble.id}
          type="button"
          className={`countdown-bubble${pausedBubbleId === bubble.id ? ' countdown-bubble--paused' : ''}`}
          style={{
            transform: `translate3d(${bubble.x}px, ${bubble.y}px, 0)`,
          }}
          onMouseEnter={() => {
            pausedBubbleIdRef.current = bubble.id
            setPausedBubbleId(bubble.id)
          }}
          onMouseLeave={() => {
            pausedBubbleIdRef.current = null
            setPausedBubbleId(null)
          }}
          onClick={() => speakCountdown(bubble.title, bubble.targetDate)}
          title={`${bubble.title} · 点击语音播报`}
        >
          <span className="countdown-bubble-inner">
            <span className="countdown-bubble-days">
              {formatCountdownLabel(bubble.targetDate)}
            </span>
            <span className="countdown-bubble-title">{bubble.title}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
