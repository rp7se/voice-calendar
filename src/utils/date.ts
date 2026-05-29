/** 月历网格中的单日数据 */
export type CalendarDay = {
  date: Date
  year: number
  /** JavaScript Date 月份，0 表示 1 月 */
  month: number
  day: number
  isCurrentMonth: boolean
}

export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatYearMonth(year: number, month: number): string {
  return `${year}年${month + 1}月`
}

export function isSameDate(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  )
}

export function isToday(date: Date): boolean {
  return isSameDate(date, new Date())
}

function parseDateString(dateStr: string): Date | null {
  const parts = dateStr.trim().split('-')
  if (parts.length !== 3) {
    return null
  }

  const year = Number(parts[0])
  const month = Number(parts[1]) - 1
  const day = Number(parts[2])

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null
  }

  const date = new Date(year, month, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * 计算目标日期与今天相差的天数（归零时分秒）。
 * 正数表示未来，负数表示已过去，0 表示今天。
 */
export function getDaysBetweenToday(targetDate: string): number | null {
  const target = parseDateString(targetDate)
  if (!target) {
    return null
  }

  const today = startOfDay(new Date())
  const targetDay = startOfDay(target)
  const msPerDay = 24 * 60 * 60 * 1000

  return Math.round((targetDay.getTime() - today.getTime()) / msPerDay)
}

/** 倒计时剩余天数展示文案 */
export function formatCountdownLabel(targetDate: string): string {
  const days = getDaysBetweenToday(targetDate)
  if (days === null) {
    return '日期无效'
  }
  if (days === 0) {
    return '就是今天'
  }
  if (days > 0) {
    return `还有 ${days} 天`
  }
  return `已过去 ${Math.abs(days)} 天`
}

/** 倒计时语音播报文案 */
export function formatCountdownSpeech(title: string, targetDate: string): string {
  const days = getDaysBetweenToday(targetDate)
  if (days === null) {
    return `${title}的日期无效`
  }
  if (days === 0) {
    return `${title}就是今天`
  }
  if (days > 0) {
    return `距离${title}还有 ${days} 天`
  }
  return `${title}已经过去 ${Math.abs(days)} 天`
}

/**
 * 返回月历网格所需日期（周日起始，7 列）。
 * @param year 年份
 * @param month JavaScript Date 月份，0-11
 */
export function getMonthDays(year: number, month: number): CalendarDay[] {
  const firstDayOfMonth = new Date(year, month, 1)
  const startOffset = firstDayOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cellCount = Math.ceil((startOffset + daysInMonth) / 7) * 7

  const days: CalendarDay[] = []

  for (let i = 0; i < cellCount; i++) {
    const date = new Date(year, month, 1 - startOffset + i)
    days.push({
      date,
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
    })
  }

  return days
}
