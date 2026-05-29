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
