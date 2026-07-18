import type { ReminderMinutesBefore } from '../types/calendar.ts'

export const REMINDER_OPTIONS: readonly {
  value: ReminderMinutesBefore
  label: string
}[] = [
  { value: null, label: '不提醒' },
  { value: 0, label: '开始时提醒' },
  { value: 5, label: '提前 5 分钟' },
  { value: 10, label: '提前 10 分钟' },
  { value: 15, label: '提前 15 分钟' },
  { value: 30, label: '提前 30 分钟' },
  { value: 60, label: '提前 1 小时' },
  { value: 1440, label: '提前 1 天' },
]

export function formatReminderLabel(minutes: ReminderMinutesBefore): string {
  return (
    REMINDER_OPTIONS.find((option) => option.value === minutes)?.label ??
    `提前 ${minutes} 分钟`
  )
}

export function parseReminderSelectValue(value: string): ReminderMinutesBefore {
  if (value === '') {
    return null
  }

  const minutes = Number(value)
  const isSupported = REMINDER_OPTIONS.some((option) => option.value === minutes)
  return isSupported ? minutes : null
}

export function isValidReminderMinutes(
  minutes: ReminderMinutesBefore,
): boolean {
  return (
    minutes === null ||
    (Number.isInteger(minutes) && minutes >= 0 && minutes <= 10080)
  )
}
