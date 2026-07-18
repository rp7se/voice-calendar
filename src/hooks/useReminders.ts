import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ackReminder,
  getPendingReminders,
  type ReminderDto,
} from '../api/reminderApi.ts'
import { connectReminderStream } from '../services/reminderStream.ts'

export type ReminderConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export function useReminders() {
  const [queue, setQueue] = useState<ReminderDto[]>([])
  const [connectionStatus, setConnectionStatus] =
    useState<ReminderConnectionStatus>('connecting')
  const [isAcknowledging, setIsAcknowledging] = useState(false)
  const [ackError, setAckError] = useState('')
  const handledIdsRef = useRef(new Set<string>())

  const enqueue = useCallback((reminder: ReminderDto) => {
    if (handledIdsRef.current.has(reminder.id)) {
      return
    }
    handledIdsRef.current.add(reminder.id)
    setQueue((current) => [...current, reminder])
  }, [])

  useEffect(() => {
    let active = true

    const recoverPending = async () => {
      try {
        const reminders = await getPendingReminders()
        if (active) {
          reminders.forEach(enqueue)
        }
      } catch {
        if (active) {
          setConnectionStatus('disconnected')
        }
      }
    }

    const closeStream = connectReminderStream({
      onOpen: () => {
        if (!active) {
          return
        }
        setConnectionStatus('connected')
        void recoverPending()
      },
      onReminder: (reminder) => {
        if (active) {
          enqueue(reminder)
        }
      },
      onDisconnect: () => {
        if (active) {
          setConnectionStatus('disconnected')
        }
      },
      onPayloadError: () => {
        // Ignore one malformed event while keeping EventSource auto-reconnect active.
      },
    })

    return () => {
      active = false
      closeStream()
    }
  }, [enqueue])

  const activeReminder = queue[0] ?? null

  const acknowledgeActive = useCallback(async () => {
    if (!activeReminder || isAcknowledging) {
      return
    }

    setIsAcknowledging(true)
    setAckError('')
    try {
      await ackReminder(activeReminder.id)
      setQueue((current) => current.filter((item) => item.id !== activeReminder.id))
    } catch {
      setAckError('确认失败，请检查提醒服务后重试。')
    } finally {
      setIsAcknowledging(false)
    }
  }, [activeReminder, isAcknowledging])

  return {
    activeReminder,
    pendingCount: queue.length,
    connectionStatus,
    isAcknowledging,
    ackError,
    acknowledgeActive,
  }
}
