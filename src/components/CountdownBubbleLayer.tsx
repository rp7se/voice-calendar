import { useEffect, useRef, useState } from 'react'
import type { CountdownItem } from '../types/calendar.ts'
import { getCountdowns } from '../utils/storage.ts'
import { formatCountdownLabel, formatCountdownSpeech } from '../utils/date.ts'

type CountdownBubbleLayerProps = {
  refreshVersion?: number
  disabled?: boolean
}

type BubblePhysics = {
  id: string
  title: string
  targetDate: string
  x: number
  y: number
  vx: number
  vy: number
  zoneIndex: number
}

type SafeZone = {
  x: number
  y: number
  width: number
  height: number
}

const BUBBLE_SIZE = 104
const MIN_GAP = 16
const SPEED = 0.22
const APP_MAX_WIDTH = 1320
const PAGE_SIDE_PADDING = 28
const MIN_SAFE_ZONE_WIDTH = BUBBLE_SIZE + 8
const MIN_SAFE_ZONE_HEIGHT = BUBBLE_SIZE + 8

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

function createSafeZones(viewportWidth: number, viewportHeight: number): SafeZone[] {
  if (viewportWidth < 900 || viewportHeight < 520) {
    return []
  }

  const contentWidth = Math.min(APP_MAX_WIDTH, viewportWidth - PAGE_SIDE_PADDING * 2)
  const contentLeft = (viewportWidth - contentWidth) / 2
  const contentRight = contentLeft + contentWidth
  const sideTop = 130
  const sideHeight = viewportHeight - 260
  const zones: SafeZone[] = [
    {
      x: 24,
      y: sideTop,
      width: contentLeft - 36,
      height: sideHeight,
    },
    {
      x: contentRight + 12,
      y: sideTop,
      width: viewportWidth - contentRight - 36,
      height: sideHeight,
    },
  ]

  const protectedSelectors = [
    '.voice-control',
    '.main-layout',
    '.calendar-view',
    '.countdown-panel',
    '.right-sidebar',
  ]
  const protectedBottom = protectedSelectors.reduce((bottom, selector) => {
    const element = document.querySelector(selector)
    const rect = element?.getBoundingClientRect()
    return rect ? Math.max(bottom, rect.bottom) : bottom
  }, 0)
  const bottomY = protectedBottom + 24
  const bottomHeight = viewportHeight - bottomY - 24

  if (bottomHeight >= MIN_SAFE_ZONE_HEIGHT) {
    zones.push({
      x: contentLeft + 24,
      y: bottomY,
      width: contentWidth - 48,
      height: bottomHeight,
    })
  }

  return zones.filter(
    (zone) =>
      zone.width >= MIN_SAFE_ZONE_WIDTH &&
      zone.height >= MIN_SAFE_ZONE_HEIGHT &&
      zone.x >= 0 &&
      zone.y >= 0,
  )
}

function clampToZone(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getBubbleZone(bubble: BubblePhysics, zones: SafeZone[]): SafeZone | null {
  return zones[bubble.zoneIndex] ?? zones[0] ?? null
}

function createInitialBubbles(
  items: CountdownItem[],
  viewportWidth: number,
  viewportHeight: number,
): BubblePhysics[] {
  const safeZones = createSafeZones(viewportWidth, viewportHeight)
  if (safeZones.length === 0) {
    return []
  }

  return items.map((item, index) => {
    const angle = (index * 1.7 + 0.5) % (Math.PI * 2)
    const zoneIndex = index % safeZones.length
    const zone = safeZones[zoneIndex]
    const maxX = zone.x + zone.width - BUBBLE_SIZE
    const maxY = zone.y + zone.height - BUBBLE_SIZE
    const offset = index * 37
    const x = clampToZone(zone.x + MIN_GAP + (offset % Math.max(1, zone.width - BUBBLE_SIZE - MIN_GAP * 2)), zone.x, maxX)
    const y = clampToZone(zone.y + MIN_GAP + ((offset * 1.6) % Math.max(1, zone.height - BUBBLE_SIZE - MIN_GAP * 2)), zone.y, maxY)

    return {
      id: item.id,
      title: item.title,
      targetDate: item.targetDate,
      x,
      y,
      vx: Math.cos(angle) * SPEED,
      vy: Math.sin(angle) * SPEED,
      zoneIndex,
    }
  })
}

export default function CountdownBubbleLayer({
  refreshVersion = 0,
  disabled = false,
}: CountdownBubbleLayerProps) {
  const [bubbles, setBubbles] = useState<BubblePhysics[]>([])
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([])
  const [pausedBubbleId, setPausedBubbleId] = useState<string | null>(null)
  const pausedBubbleIdRef = useRef<string | null>(null)

  useEffect(() => {
    setCountdowns(getCountdowns())
  }, [refreshVersion])

  useEffect(() => {
    if (disabled || countdowns.length === 0) {
      setBubbles([])
      return
    }

    let physics = createInitialBubbles(countdowns, window.innerWidth, window.innerHeight)

    let animationId = 0

    const tick = () => {
      const safeZones = createSafeZones(window.innerWidth, window.innerHeight)
      if (safeZones.length === 0) {
        setBubbles([])
        animationId = window.requestAnimationFrame(tick)
        return
      }

      const currentPausedBubbleId = pausedBubbleIdRef.current

      for (const bubble of physics) {
        const zone = getBubbleZone(bubble, safeZones)
        if (!zone) {
          continue
        }

        const maxX = zone.x + zone.width - BUBBLE_SIZE
        const maxY = zone.y + zone.height - BUBBLE_SIZE

        if (bubble.id === currentPausedBubbleId) {
          bubble.x = clampToZone(bubble.x, zone.x, maxX)
          bubble.y = clampToZone(bubble.y, zone.y, maxY)
          continue
        }

        let nextX = bubble.x + bubble.vx
        let nextY = bubble.y + bubble.vy

        if (nextX <= zone.x) {
          nextX = zone.x
          bubble.vx = Math.abs(bubble.vx)
        } else if (nextX >= maxX) {
          nextX = maxX
          bubble.vx = -Math.abs(bubble.vx)
        }

        if (nextY <= zone.y) {
          nextY = zone.y
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
      const safeZones = createSafeZones(window.innerWidth, window.innerHeight)
      if (safeZones.length === 0) {
        physics = []
        setBubbles([])
        return
      }

      physics = physics.map((bubble, index) => {
        const nextZoneIndex = bubble.zoneIndex < safeZones.length ? bubble.zoneIndex : index % safeZones.length
        const zone = safeZones[nextZoneIndex]
        return {
          ...bubble,
          zoneIndex: nextZoneIndex,
          x: clampToZone(bubble.x, zone.x, zone.x + zone.width - BUBBLE_SIZE),
          y: clampToZone(bubble.y, zone.y, zone.y + zone.height - BUBBLE_SIZE),
        }
      })
      setBubbles(physics.map((bubble) => ({ ...bubble })))
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [countdowns, disabled])

  if (disabled || countdowns.length === 0 || bubbles.length === 0) {
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
