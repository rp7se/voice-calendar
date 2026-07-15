import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'

import { getAmbientHistoryEvents } from '../data/historyEvents'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  depth: number
  twinkle: number
  phase: number
  color: string
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const MOBILE_QUERY = '(max-width: 768px)'
const TABLET_QUERY = '(max-width: 1100px)'
const POINTER_QUERY = '(pointer: fine)'
const MAX_DPR = 1.75

type AmbientStyle = CSSProperties & Record<`--${string}`, string>

function getParticleCount(width: number, isMobile: boolean, isTablet: boolean): number {
  if (isMobile) {
    return 76
  }
  if (isTablet) {
    return 150
  }
  return width > 1500 ? 300 : 230
}

function pickParticleColor(index: number, colors: string[]): string {
  return colors[index % colors.length] || 'rgba(255, 255, 255, 0.96)'
}

function createParticles(count: number, width: number, height: number, colors: string[]): Particle[] {
  return Array.from({ length: count }, (_, index) => {
    const depthRoll = Math.random()
    const depth = depthRoll > 0.9 ? 1 : depthRoll > 0.48 ? 0.58 : 0.22
    const drift = 0.08 + depth * 0.34

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * drift,
      vy: (-0.035 - Math.random() * 0.12) * (0.55 + depth),
      radius: 0.45 + depth * 1.45 + Math.random() * (0.85 + depth * 0.55),
      alpha: 0.34 + depth * 0.38 + Math.random() * 0.24,
      depth,
      twinkle: 0.08 + Math.random() * 0.22,
      phase: Math.random() * Math.PI * 2,
      color: pickParticleColor(index, colors),
    }
  })
}

function drawParticles(
  context: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  shouldMove: boolean,
  time: number,
): void {
  context.clearRect(0, 0, width, height)

  for (const particle of particles) {
    if (shouldMove) {
      particle.x += particle.vx
      particle.y += particle.vy

      if (particle.y < -8) {
        particle.y = height + 8
        particle.x = Math.random() * width
      }
      if (particle.x < -8) {
        particle.x = width + 8
      } else if (particle.x > width + 8) {
        particle.x = -8
      }
    }

    const pulse = 1 + Math.sin(time * (0.0007 + particle.twinkle * 0.0007) + particle.phase) * 0.16
    const alpha = Math.min(0.98, particle.alpha * pulse)

    context.beginPath()
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
    context.globalAlpha = alpha
    context.fillStyle = particle.color
    context.shadowBlur = particle.depth > 0.78 ? 8 : particle.depth > 0.5 ? 3 : 0
    context.shadowColor = particle.color
    context.fill()
    context.shadowBlur = 0
  }

  context.globalAlpha = 1
}

export default function AmbientBackground() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const historyStreamEvents = getAmbientHistoryEvents(new Date())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY)
    const mobileQuery = window.matchMedia(MOBILE_QUERY)
    const tabletQuery = window.matchMedia(TABLET_QUERY)

    let animationId = 0
    let width = 0
    let height = 0
    let particles: Particle[] = []
    let isVisible = document.visibilityState === 'visible'
    let particleColors: string[] = []

    const stopAnimation = () => {
      if (animationId !== 0) {
        window.cancelAnimationFrame(animationId)
        animationId = 0
      }
    }

    const startAnimation = () => {
      if (
        animationId === 0 &&
        isVisible &&
        !reducedMotionQuery.matches &&
        particles.length > 0
      ) {
        animationId = window.requestAnimationFrame(tick)
      }
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const styles = getComputedStyle(document.documentElement)
      particleColors = [
        styles.getPropertyValue('--ambient-particle-cold').trim(),
        styles.getPropertyValue('--ambient-particle-blue').trim(),
        styles.getPropertyValue('--ambient-particle-white').trim(),
        styles.getPropertyValue('--ambient-particle-white').trim(),
        styles.getPropertyValue('--ambient-particle-white').trim(),
      ].filter(Boolean)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      particles = createParticles(
        getParticleCount(width, mobileQuery.matches, tabletQuery.matches),
        width,
        height,
        particleColors,
      )
      drawParticles(context, particles, width, height, false, 0)
    }

    const tick = (time: number) => {
      animationId = 0
      if (isVisible && !reducedMotionQuery.matches && particles.length > 0) {
        drawParticles(context, particles, width, height, true, time)
      }
      startAnimation()
    }

    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible'
      if (isVisible) {
        startAnimation()
      } else {
        stopAnimation()
      }
    }

    const handleAmbientSettingsChange = () => {
      resize()
      stopAnimation()
      startAnimation()
    }

    resize()
    startAnimation()

    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    reducedMotionQuery.addEventListener('change', handleAmbientSettingsChange)
    mobileQuery.addEventListener('change', handleAmbientSettingsChange)
    tabletQuery.addEventListener('change', handleAmbientSettingsChange)

    return () => {
      stopAnimation()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      reducedMotionQuery.removeEventListener('change', handleAmbientSettingsChange)
      mobileQuery.removeEventListener('change', handleAmbientSettingsChange)
      tabletQuery.removeEventListener('change', handleAmbientSettingsChange)
    }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const pointerQuery = window.matchMedia(POINTER_QUERY)
    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY)
    let frameId = 0
    let targetX = 0
    let targetY = 0

    const resetParallax = () => {
      root.style.setProperty('--ambient-parallax-x', '0px')
      root.style.setProperty('--ambient-parallax-y', '0px')
    }

    const applyParallax = () => {
      frameId = 0
      root.style.setProperty('--ambient-parallax-x', `${targetX.toFixed(2)}px`)
      root.style.setProperty('--ambient-parallax-y', `${targetY.toFixed(2)}px`)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerQuery.matches || reducedMotionQuery.matches) {
        resetParallax()
        return
      }

      targetX = ((event.clientX / window.innerWidth) - 0.5) * 8
      targetY = ((event.clientY / window.innerHeight) - 0.5) * 8

      if (frameId === 0) {
        frameId = window.requestAnimationFrame(applyParallax)
      }
    }

    const handleMotionPreferenceChange = () => {
      if (reducedMotionQuery.matches || !pointerQuery.matches) {
        resetParallax()
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    pointerQuery.addEventListener('change', handleMotionPreferenceChange)
    reducedMotionQuery.addEventListener('change', handleMotionPreferenceChange)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('pointermove', handlePointerMove)
      pointerQuery.removeEventListener('change', handleMotionPreferenceChange)
      reducedMotionQuery.removeEventListener('change', handleMotionPreferenceChange)
    }
  }, [])

  return (
    <div ref={rootRef} className="ambient-background" aria-hidden="true">
      <div className="ambient-aurora-layer" />
      <div className="ambient-grid-layer" />
      <div className="ambient-history-stream">
        {historyStreamEvents.map((event, index) => (
          <span
            key={`${event.year}-${event.month}-${event.day}-${event.title}`}
            className="ambient-history-item"
            style={
              {
                '--history-delay': `${index * -12}s`,
                '--history-duration': `${58 + (index % 3) * 8}s`,
                '--history-y': `${12 + ((index * 19) % 68)}%`,
              } as AmbientStyle
            }
          >
            <strong>{event.year}</strong>
            <span aria-hidden="true">·</span>
            <span>{event.title}</span>
          </span>
        ))}
      </div>
      <canvas ref={canvasRef} className="ambient-particle-layer" />
      <div className="ambient-depth-layer" />
    </div>
  )
}
