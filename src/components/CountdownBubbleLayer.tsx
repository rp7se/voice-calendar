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
  width: number
  height: number
}

type BubbleBounds = Pick<BubblePhysics, 'x' | 'y' | 'width' | 'height'>

const BUBBLE_SIZE = 104
const BUBBLE_WIDTH = BUBBLE_SIZE
const BUBBLE_HEIGHT = BUBBLE_SIZE
const MIN_GAP = 16
const SPEED = 0.28
const MAX_SPEED = 0.5
const OBSTACLE_PADDING = 18
const AVOID_SELECTORS = [
  '.app-header',
  '.calendar-view',
  '.countdown-panel',
  '.right-sidebar',
]

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

function getObstacleRects(): DOMRect[] {
  return AVOID_SELECTORS.flatMap((selector) => {
    const element = document.querySelector(selector)
    return element ? [element.getBoundingClientRect()] : []
  })
}

function intersectsRect(a: BubbleBounds, rect: DOMRect, padding: number): boolean {
  return (
    a.x < rect.right + padding &&
    a.x + a.width > rect.left - padding &&
    a.y < rect.bottom + padding &&
    a.y + a.height > rect.top - padding
  )
}

function intersectsObstacles(bounds: BubbleBounds, obstacles: DOMRect[]): boolean {
  return obstacles.some((rect) => intersectsRect(bounds, rect, OBSTACLE_PADDING))
}

function intersectsBubble(a: BubbleBounds, b: BubbleBounds): boolean {
  return (
    a.x < b.x + b.width + MIN_GAP &&
    a.x + a.width + MIN_GAP > b.x &&
    a.y < b.y + b.height + MIN_GAP &&
    a.y + a.height + MIN_GAP > b.y
  )
}

function resolveObstacleCollision(bubble: BubblePhysics, rect: DOMRect, padding: number): void {
  const bRight = bubble.x + bubble.width
  const bBottom = bubble.y + bubble.height
  const oLeft = rect.left - padding
  const oTop = rect.top - padding
  const oRight = rect.right + padding
  const oBottom = rect.bottom + padding

  if (bRight <= oLeft || bubble.x >= oRight || bBottom <= oTop || bubble.y >= oBottom) {
    return
  }

  const overlapLeft = bRight - oLeft
  const overlapRight = oRight - bubble.x
  const overlapTop = bBottom - oTop
  const overlapBottom = oBottom - bubble.y
  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)

  if (minOverlap === overlapLeft) {
    bubble.x = oLeft - bubble.width
    bubble.vx = -Math.abs(bubble.vx)
  } else if (minOverlap === overlapRight) {
    bubble.x = oRight
    bubble.vx = Math.abs(bubble.vx)
  } else if (minOverlap === overlapTop) {
    bubble.y = oTop - bubble.height
    bubble.vy = -Math.abs(bubble.vy)
  } else {
    bubble.y = oBottom
    bubble.vy = Math.abs(bubble.vy)
  }
}

function clampVelocity(bubble: BubblePhysics): void {
  const speed = Math.hypot(bubble.vx, bubble.vy)
  if (speed <= MAX_SPEED || speed === 0) {
    return
  }

  bubble.vx = (bubble.vx / speed) * MAX_SPEED
  bubble.vy = (bubble.vy / speed) * MAX_SPEED
}

function separateBubbles(bubbles: BubblePhysics[], pausedBubbleId?: string): void {
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i]
      const b = bubbles[j]
      const canMoveA = a.id !== pausedBubbleId
      const canMoveB = b.id !== pausedBubbleId

      if (!canMoveA && !canMoveB) {
        continue
      }

      const centerAX = a.x + a.width / 2
      const centerAY = a.y + a.height / 2
      const centerBX = b.x + b.width / 2
      const centerBY = b.y + b.height / 2
      let dx = centerBX - centerAX
      let dy = centerBY - centerAY
      const dist = Math.hypot(dx, dy) || 1
      const minDist = (a.width + b.width) / 2 + MIN_GAP

      if (dist >= minDist) {
        continue
      }

      const overlap = minDist - dist
      dx /= dist
      dy /= dist
      const push = Math.min(overlap / (canMoveA && canMoveB ? 2 : 1), 0.6)

      if (canMoveA) {
        a.x -= dx * push
        a.y -= dy * push
        a.vx -= dx * 0.006
        a.vy -= dy * 0.006
      }

      if (canMoveB) {
        b.x += dx * push
        b.y += dy * push
        b.vx += dx * 0.006
        b.vy += dy * 0.006
      }
    }
  }
}

function findSafePosition(
  existing: BubblePhysics[],
  obstacles: DOMRect[],
  viewportWidth: number,
  viewportHeight: number,
  seed: number,
): { x: number; y: number } {
  for (let attempt = 0; attempt < 60; attempt++) {
    const x =
      MIN_GAP + Math.random() * Math.max(MIN_GAP, viewportWidth - BUBBLE_WIDTH - MIN_GAP * 2)
    const y =
      MIN_GAP + Math.random() * Math.max(MIN_GAP, viewportHeight - BUBBLE_HEIGHT - MIN_GAP * 2)
    const candidate: BubbleBounds = {
      x,
      y,
      width: BUBBLE_WIDTH,
      height: BUBBLE_HEIGHT,
    }

    if (intersectsObstacles(candidate, obstacles)) {
      continue
    }

    if (existing.some((bubble) => intersectsBubble(candidate, bubble))) {
      continue
    }

    return { x, y }
  }

  const edgeX = seed % 2 === 0 ? MIN_GAP : Math.max(MIN_GAP, viewportWidth - BUBBLE_WIDTH - MIN_GAP)
  const edgeY = MIN_GAP + seed * (BUBBLE_HEIGHT + MIN_GAP)
  return {
    x: edgeX,
    y: Math.min(edgeY, viewportHeight - BUBBLE_HEIGHT - MIN_GAP),
  }
}

function createInitialBubbles(
  items: CountdownItem[],
  obstacles: DOMRect[],
  viewportWidth: number,
  viewportHeight: number,
): BubblePhysics[] {
  const bubbles: BubblePhysics[] = []

  items.forEach((item, index) => {
    const { x, y } = findSafePosition(bubbles, obstacles, viewportWidth, viewportHeight, index)
    const angle = (index * 1.7 + 0.5) % (Math.PI * 2)
    bubbles.push({
      id: item.id,
      title: item.title,
      targetDate: item.targetDate,
      x,
      y,
      vx: Math.cos(angle) * SPEED,
      vy: Math.sin(angle) * SPEED,
      width: BUBBLE_WIDTH,
      height: BUBBLE_HEIGHT,
    })
  })

  return bubbles
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

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    let physics = createInitialBubbles(
      countdowns,
      getObstacleRects(),
      viewportWidth,
      viewportHeight,
    )

    let animationId = 0
    let frameCount = 0
    let obstacles = getObstacleRects()

    const tick = () => {
      frameCount += 1
      if (frameCount % 20 === 0) {
        obstacles = getObstacleRects()
      }

      const maxX = window.innerWidth - BUBBLE_WIDTH
      const maxY = window.innerHeight - BUBBLE_HEIGHT
      const currentPausedBubbleId = pausedBubbleIdRef.current

      for (const bubble of physics) {
        if (bubble.id === currentPausedBubbleId) {
          continue
        }

        bubble.x += bubble.vx
        bubble.y += bubble.vy

        if (bubble.x <= MIN_GAP) {
          bubble.x = MIN_GAP
          bubble.vx = Math.abs(bubble.vx)
        } else if (bubble.x >= maxX - MIN_GAP) {
          bubble.x = maxX - MIN_GAP
          bubble.vx = -Math.abs(bubble.vx)
        }

        if (bubble.y <= MIN_GAP) {
          bubble.y = MIN_GAP
          bubble.vy = Math.abs(bubble.vy)
        } else if (bubble.y >= maxY - MIN_GAP) {
          bubble.y = maxY - MIN_GAP
          bubble.vy = -Math.abs(bubble.vy)
        }

        for (const rect of obstacles) {
          resolveObstacleCollision(bubble, rect, OBSTACLE_PADDING)
        }

        clampVelocity(bubble)
      }

      separateBubbles(physics, currentPausedBubbleId ?? undefined)
      physics.forEach(clampVelocity)
      setBubbles(physics.map((bubble) => ({ ...bubble })))
      animationId = window.requestAnimationFrame(tick)
    }

    setBubbles(physics)
    animationId = window.requestAnimationFrame(tick)

    const handleResize = () => {
      obstacles = getObstacleRects()
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)

    return () => {
      window.cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
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
            transform: `translate(${bubble.x}px, ${bubble.y}px)`,
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
