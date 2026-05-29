function createAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') {
      return null
    }
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) {
      return null
    }
    return new AudioContextClass()
  } catch {
    return null
  }
}

function playToneSequence(
  frequencies: number[],
  options: { duration?: number; gap?: number; volume?: number },
): void {
  const ctx = createAudioContext()
  if (!ctx) {
    return
  }

  const duration = options.duration ?? 0.28
  const gap = options.gap ?? 0.1
  const volume = options.volume ?? 0.12
  const startAt = ctx.currentTime

  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    const noteStart = startAt + index * (duration + gap)

    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0, noteStart)
    gain.gain.linearRampToValueAtTime(volume, noteStart + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, noteStart + duration)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(noteStart)
    oscillator.stop(noteStart + duration + 0.05)
  })

  const totalMs = (frequencies.length * (duration + gap) + 0.2) * 1000
  window.setTimeout(() => {
    void ctx.close()
  }, totalMs)
}

/** 完成目标：轻快上扬的成功提示音 */
export function playCompletionSuccessTone(): void {
  playToneSequence([523.25, 659.25, 783.99, 1046.5], {
    duration: 0.22,
    gap: 0.08,
    volume: 0.14,
  })
}

/** 尚未完成：轻柔鼓励提示音 */
export function playEncouragementTone(): void {
  playToneSequence([392, 440, 493.88], {
    duration: 0.32,
    gap: 0.12,
    volume: 0.08,
  })
}
