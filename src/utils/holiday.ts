import { HOLIDAYS } from '../data/holidays.ts'
import type { HolidayInfo } from '../types/calendar.ts'

function extractMonthDay(date: string): string | undefined {
  const parts = date.trim().split('-')
  if (parts.length !== 3) {
    return undefined
  }
  const [, month, day] = parts
  if (!month || !day || month.length !== 2 || day.length !== 2) {
    return undefined
  }
  return `${month}-${day}`
}

/**
 * 根据 YYYY-MM-DD 查询节日。
 * 优先匹配完整日期，再匹配 MM-DD 固定节日。
 */
export function getHolidayByDate(date: string): HolidayInfo | undefined {
  try {
    if (!date || typeof date !== 'string') {
      return undefined
    }

    const normalizedDate = date.trim()
    const monthDay = extractMonthDay(normalizedDate)
    if (!monthDay) {
      return undefined
    }

    const exactMatch = HOLIDAYS.find((holiday) => holiday.date === normalizedDate)
    if (exactMatch) {
      return exactMatch
    }

    return HOLIDAYS.find((holiday) => holiday.date === monthDay)
  } catch {
    return undefined
  }
}
