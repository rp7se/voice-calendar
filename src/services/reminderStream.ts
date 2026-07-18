import {
  getReminderStreamUrl,
  parseReminder,
  type ReminderDto,
} from '../api/reminderApi.ts'

type ReminderStreamHandlers = {
  onOpen: () => void
  onReminder: (reminder: ReminderDto) => void
  onDisconnect: () => void
  onPayloadError?: () => void
}

const STALE_CONNECTION_TIMEOUT_MS = 35_000

export function connectReminderStream(handlers: ReminderStreamHandlers): () => void {
  let active = true
  let source: EventSource | null = null
  let closedRetryTimer: ReturnType<typeof setTimeout> | null = null
  let staleConnectionTimer: ReturnType<typeof setTimeout> | null = null

  const clearStaleConnectionTimer = () => {
    if (staleConnectionTimer !== null) {
      clearTimeout(staleConnectionTimer)
      staleConnectionTimer = null
    }
  }

  const watchForStaleConnection = (currentSource: EventSource) => {
    clearStaleConnectionTimer()
    staleConnectionTimer = setTimeout(() => {
      staleConnectionTimer = null
      if (active && source === currentSource) {
        currentSource.close()
        open()
      }
    }, STALE_CONNECTION_TIMEOUT_MS)
  }

  function open() {
    if (!active) {
      return
    }

    const currentSource = new EventSource(getReminderStreamUrl())
    source = currentSource
    currentSource.onopen = () => {
      watchForStaleConnection(currentSource)
      handlers.onOpen()
    }
    currentSource.onerror = () => {
      handlers.onDisconnect()

      if (closedRetryTimer !== null) {
        clearTimeout(closedRetryTimer)
      }
      closedRetryTimer = setTimeout(() => {
        closedRetryTimer = null
        if (
          active &&
          source === currentSource &&
          currentSource.readyState === EventSource.CLOSED
        ) {
          currentSource.close()
          open()
        }
      }, 3_000)
    }
    currentSource.addEventListener('reminder', (event) => {
      watchForStaleConnection(currentSource)
      try {
        const value: unknown = JSON.parse((event as MessageEvent<string>).data)
        handlers.onReminder(parseReminder(value))
      } catch {
        handlers.onPayloadError?.()
      }
    })
    currentSource.addEventListener('heartbeat', () => {
      watchForStaleConnection(currentSource)
    })
  }

  open()

  return () => {
    active = false
    if (closedRetryTimer !== null) {
      clearTimeout(closedRetryTimer)
    }
    clearStaleConnectionTimer()
    source?.close()
  }
}
