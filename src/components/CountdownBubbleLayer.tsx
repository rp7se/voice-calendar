import { useEffect, useMemo, useRef } from 'react'
import type { CountdownItem } from '../types/calendar.ts'
import { getCountdowns } from '../utils/storage.ts'
import {
  formatCountdownLabel,
  formatCountdownSpeech,
  getDaysBetweenToday,
} from '../utils/date.ts'

type CountdownBubbleLayerProps = {
  refreshVersion?: number
}

type BubblePhysics = {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  size: number
}

type BubbleBounds = Pick<BubblePhysics, 'x' | 'y' | 'size'>

const MIN_GAP = 18
const SPEED = 0.34
const MAX_DESKTOP_BUBBLES = 8
const MAX_MOBILE_BUBBLES = 4

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

function supportsReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function getBubbleSize(item: CountdownItem): number {
  const days = getDaysBetweenToday(item.targetDate)
  if (days !== null && days >= 0 && days <= 7) {
    return 128
  }
  if (days !== null && days > 7 && days <= 30) {
    return 116
  }
  return 104
}

function getUrgencyClass(targetDate: string): string {
  const days = getDaysBetweenToday(targetDate)
  if (days === null) {
    return 'countdown-bubble--neutral'
  }
  if (days === 0) {
    return 'countdown-bubble--today'
  }
  if (days > 0 && days <= 7) {
    return 'countdown-bubble--soon'
  }
  if (days < 0) {
    return 'countdown-bubble--past'
  }
  return 'countdown-bubble--future'
}

function intersectsBubble(a: BubbleBounds, b: BubbleBounds): boolean {
  return (
    a.x < b.x + b.size + MIN_GAP &&
    a.x + a.size + MIN_GAP > b.x &&
    a.y < b.y + b.size + MIN_GAP &&
    a.y + a.size + MIN_GAP > b.y
  )
}

function separateBubbles(bubbles: BubblePhysics[]): void {
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i]
      const b = bubbles[j]
      const centerAX = a.x + a.size / 2
      const centerAY = a.y + a.size / 2
      const centerBX = b.x + b.size / 2
      const centerBY = b.y + b.size / 2
      let dx = centerBX - centerAX
      let dy = centerBY - centerAY
      const dist = Math.hypot(dx, dy) || 1
      const minDist = (a.size + b.size) / 2 + MIN_GAP

      if (dist >= minDist) {
        continue
      }

      const overlap = minDist - dist
      dx /= dist
      dy /= dist
      a.x -= (dx * overlap) / 2
      a.y -= (dy * overlap) / 2
      b.x += (dx * overlap) / 2
      b.y += (dy * overlap) / 2
      a.vx -= dx * 0.015
      a.vy -= dy * 0.015
      b.vx += dx * 0.015
      b.vy += dy * 0.015
    }
  }
}

function findSafePosition(
  existing: BubblePhysics[],
  width: number,
  height: number,
  size: number,
  seed: number,
): { x: number; y: number } {
  for (let attempt = 0; attempt < 54; attempt++) {
    const sequence = seed * 17 + attempt * 11
    const xRatio = (sequence * 0.61803398875) % 1
    const yRatio = (sequence * 0.41421356237) % 1
    const x = MIN_GAP + xRatio * Math.max(MIN_GAP, width - size - MIN_GAP * 2)
    const y = MIN_GAP + yRatio * Math.max(MIN_GAP, height - size - MIN_GAP * 2)
    const candidate = { x, y, size }

    if (!existing.some((bubble) => intersectsBubble(candidate, bubble))) {
      return { x, y }
    }
  }

  const column = seed % 3
  const row = Math.floor(seed / 3)
  return {
    x: MIN_GAP + column * (size + MIN_GAP),
    y: MIN_GAP + row * (size + MIN_GAP),
  }
}

function createInitialBubbles(
  items: CountdownItem[],
  width: number,
  height: number,
): BubblePhysics[] {
  const bubbles: BubblePhysics[] = []

  items.forEach((item, index) => {
    const size = getBubbleSize(item)
    const { x, y } = findSafePosition(bubbles, width, height, size, index + 1)
    const angle = (index * 1.46 + 0.7) % (Math.PI * 2)
    bubbles.push({
      id: item.id,
      x,
      y,
      vx: Math.cos(angle) * SPEED,
      vy: Math.sin(angle) * SPEED,
      size,
    })
  })

  return bubbles
}

export default function CountdownBubbleLayer({
  refreshVersion = 0,
}: CountdownBubbleLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null)
  const bubbleRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const pausedIdsRef = useRef(new Set<string>())

  const countdowns = useMemo(() => {
    if (refreshVersion < 0) {
      return []
    }

    const maxItems =
      typeof window !== 'undefined' && window.innerWidth <= 680
        ? MAX_MOBILE_BUBBLES
        : MAX_DESKTOP_BUBBLES

    return getCountdowns()
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
      .slice(0, maxItems)
  }, [refreshVersion])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer || countdowns.length === 0) {
      return
    }

    const applyBubbleStyles = (physics: BubblePhysics[]) => {
      for (const bubble of physics) {
        const element = bubbleRefs.current[bubble.id]
        if (!element) {
          continue
        }
        element.style.width = `${bubble.size}px`
        element.style.height = `${bubble.size}px`
        element.style.transform = `translate3d(${bubble.x}px, ${bubble.y}px, 0)`
      }
    }

    let frameId = 0
    let bounds = layer.getBoundingClientRect()
    let physics = createInitialBubbles(countdowns, bounds.width, bounds.height)
    applyBubbleStyles(physics)

    if (supportsReducedMotion()) {
      layer.classList.add('countdown-bubble-layer--reduced')
      return () => {
        layer.classList.remove('countdown-bubble-layer--reduced')
      }
    }

    const tick = () => {
      bounds = layer.getBoundingClientRect()
      const maxX = Math.max(MIN_GAP, bounds.width)
      const maxY = Math.max(MIN_GAP, bounds.height)

      for (const bubble of physics) {
        if (!pausedIdsRef.current.has(bubble.id)) {
          bubble.x += bubble.vx
          bubble.y += bubble.vy
        }

        if (bubble.x <= MIN_GAP) {
          bubble.x = MIN_GAP
          bubble.vx = Math.abs(bubble.vx)
        } else if (bubble.x + bubble.size >= maxX - MIN_GAP) {
          bubble.x = maxX - bubble.size - MIN_GAP
          bubble.vx = -Math.abs(bubble.vx)
        }

        if (bubble.y <= MIN_GAP) {
          bubble.y = MIN_GAP
          bubble.vy = Math.abs(bubble.vy)
        } else if (bubble.y + bubble.size >= maxY - MIN_GAP) {
          bubble.y = maxY - bubble.size - MIN_GAP
          bubble.vy = -Math.abs(bubble.vy)
        }
      }

      separateBubbles(physics)
      applyBubbleStyles(physics)
      frameId = window.requestAnimationFrame(tick)
    }

    const handleResize = () => {
      bounds = layer.getBoundingClientRect()
      physics = createInitialBubbles(countdowns, bounds.width, bounds.height)
      applyBubbleStyles(physics)
    }

    window.addEventListener('resize', handleResize)
    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', handleResize)
    }
  }, [countdowns])

  if (countdowns.length === 0) {
    return null
  }

  return (
    <div
      ref={layerRef}
      className="countdown-bubble-layer"
      aria-label="专注模式倒计时气泡"
    >
      {countdowns.map((item) => (
        <button
          key={item.id}
          ref={(element) => {
            bubbleRefs.current[item.id] = element
          }}
          type="button"
          className={`countdown-bubble ${getUrgencyClass(item.targetDate)}`}
          onMouseEnter={() => pausedIdsRef.current.add(item.id)}
          onMouseLeave={() => pausedIdsRef.current.delete(item.id)}
          onFocus={() => pausedIdsRef.current.add(item.id)}
          onBlur={() => pausedIdsRef.current.delete(item.id)}
          onClick={() => speakCountdown(item.title, item.targetDate)}
          title={`${item.title} · 点击语音播报`}
        >
          <span className="countdown-bubble-inner">
            <span className="countdown-bubble-title">{item.title}</span>
            <span className="countdown-bubble-days">
              {formatCountdownLabel(item.targetDate)}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
