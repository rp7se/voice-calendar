import type { EventType } from '../types/calendar.ts'
import { formatDate } from './date.ts'

export type VoiceCommandIntent =
  | 'add'
  | 'query'
  | 'delete'
  | 'time'
  | 'summary_day'
  | 'summary_week'
  | 'countdown_query'
  | 'category_date_add'
  | 'unknown'

export type ParsedVoiceCommand = {
  intent: VoiceCommandIntent
  rawText: string
  date?: string
  dateLabel?: string
  title?: string
  titleKeyword?: string
  categoryName?: string
  startTime?: string
  timeLabel?: string
  endTime?: string
  eventType?: EventType
  reason?: string
}

const ADD_WORDS = [
  '添加',
  '新增',
  '创建',
  '提醒我',
  '提醒',
  '帮我记',
  '记一下',
  '记录一下',
  '安排',
]

const WEEKDAY_MAP: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
}

function addDays(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

function createDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

function formatMonthDayLabel(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function getUpcomingWeekday(targetWeekday: number, nextWeek: boolean): Date {
  const today = new Date()
  const currentWeekday = today.getDay()

  if (nextWeek) {
    const daysUntilNextMonday = ((1 - currentWeekday + 7) % 7) || 7
    const mondayOfNextWeek = addDays(daysUntilNextMonday)
    const offset = targetWeekday === 0 ? 6 : targetWeekday - 1
    const date = new Date(mondayOfNextWeek)
    date.setDate(mondayOfNextWeek.getDate() + offset)
    return date
  }

  let diff = targetWeekday - currentWeekday
  if (diff < 0) {
    diff += 7
  }
  return addDays(diff)
}

function resolveDate(text: string): {
  date: string
  label: string
  matchedText?: string
  explicit: boolean
} {
  const fullDateMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})(?:日|号)?/)
  if (fullDateMatch) {
    const date = createDate(
      Number(fullDateMatch[1]),
      Number(fullDateMatch[2]),
      Number(fullDateMatch[3]),
    )
    if (date) {
      return {
        date: formatDate(date),
        label: formatMonthDayLabel(date),
        matchedText: fullDateMatch[0],
        explicit: true,
      }
    }
  }

  const monthDayMatch = text.match(/(\d{1,2})月(\d{1,2})(?:日|号)/)
  if (monthDayMatch) {
    const today = new Date()
    const date = createDate(
      today.getFullYear(),
      Number(monthDayMatch[1]),
      Number(monthDayMatch[2]),
    )
    if (date) {
      return {
        date: formatDate(date),
        label: formatMonthDayLabel(date),
        matchedText: monthDayMatch[0],
        explicit: true,
      }
    }
  }

  const weekdayMatch = text.match(
    /(?:(下周|下星期|下礼拜)([日天一二三四五六])|(?:周|星期|礼拜)([日天一二三四五六]))/,
  )
  if (weekdayMatch) {
    const nextWeek = Boolean(weekdayMatch[1])
    const weekdayText = weekdayMatch[2] ?? weekdayMatch[3]
    const date = getUpcomingWeekday(WEEKDAY_MAP[weekdayText], nextWeek)
    return {
      date: formatDate(date),
      label: `${nextWeek ? '下周' : '周'}${weekdayText}`,
      matchedText: weekdayMatch[0],
      explicit: true,
    }
  }

  if (text.includes('后天')) {
    return { date: formatDate(addDays(2)), label: '后天', matchedText: '后天', explicit: true }
  }
  if (text.includes('明天')) {
    return { date: formatDate(addDays(1)), label: '明天', matchedText: '明天', explicit: true }
  }
  if (text.includes('今天')) {
    return { date: formatDate(new Date()), label: '今天', matchedText: '今天', explicit: true }
  }

  return { date: formatDate(new Date()), label: '今天', explicit: false }
}

function chineseNumberToNumber(value: string): number | null {
  if (/^\d+$/.test(value)) {
    return Number(value)
  }

  const digitMap: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  }

  if (value === '十') {
    return 10
  }

  if (value.includes('十')) {
    const [tensText, onesText] = value.split('十')
    const tens = tensText ? digitMap[tensText] : 1
    const ones = onesText ? digitMap[onesText] : 0
    if (tens === undefined || ones === undefined) {
      return null
    }
    return tens * 10 + ones
  }

  return digitMap[value] ?? null
}

function normalizeTime(
  hour: number,
  minute: number,
  period?: string,
  inferAfternoon = false,
): string | null {
  if (minute > 59) {
    return null
  }

  let normalizedHour = hour
  if ((period === '下午' || period === '晚上' || period === '今晚') && normalizedHour < 12) {
    normalizedHour += 12
  }
  if (period === '中午' && normalizedHour < 11) {
    normalizedHour += 12
  }
  if (period === '凌晨' && normalizedHour === 12) {
    normalizedHour = 0
  }
  if (!period && inferAfternoon && normalizedHour >= 1 && normalizedHour <= 11) {
    normalizedHour += 12
  }

  if (normalizedHour < 0 || normalizedHour > 23) {
    return null
  }

  return `${String(normalizedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

type ParsedTimePoint = {
  hour: number
  minute: number
  period?: string
}

function buildTimeRange(
  start: ParsedTimePoint,
  end: ParsedTimePoint,
  matchedText: string,
): { startTime: string; endTime: string; timeLabel: string; matchedText: string } | null {
  const explicitMorning =
    start.period === '上午' ||
    start.period === '早上' ||
    start.period === '凌晨' ||
    end.period === '上午' ||
    end.period === '早上' ||
    end.period === '凌晨'
  const inferAfternoon =
    !start.period && !end.period && !explicitMorning && start.hour >= 1 && start.hour <= 7
  const inheritedEndPeriod = end.period ?? start.period
  const startTime = normalizeTime(start.hour, start.minute, start.period, inferAfternoon)
  const endTime = normalizeTime(end.hour, end.minute, inheritedEndPeriod, inferAfternoon)

  if (!startTime || !endTime) {
    return null
  }

  return {
    startTime,
    endTime,
    timeLabel: `${startTime}-${endTime}`,
    matchedText,
  }
}

function parseTime(text: string): {
  startTime: string
  endTime?: string
  timeLabel: string
  matchedText: string
} | null {
  const clockRangeMatch = text.match(
    /(上午|早上|中午|下午|晚上|今晚|凌晨)?([01]?\d|2[0-3])[:：]([0-5]\d)(?:到|至|-|—|~)(上午|早上|中午|下午|晚上|今晚|凌晨)?([01]?\d|2[0-3])[:：]([0-5]\d)/,
  )
  if (clockRangeMatch) {
    const range = buildTimeRange(
      {
        period: clockRangeMatch[1],
        hour: Number(clockRangeMatch[2]),
        minute: Number(clockRangeMatch[3]),
      },
      {
        period: clockRangeMatch[4],
        hour: Number(clockRangeMatch[5]),
        minute: Number(clockRangeMatch[6]),
      },
      clockRangeMatch[0],
    )
    if (range) {
      return range
    }
  }

  const hourText = '[零〇一二两三四五六七八九十\\d]{1,3}'
  const textRangeMatch = text.match(
    new RegExp(`(上午|早上|中午|下午|晚上|今晚|凌晨)?(${hourText})点(半|(${hourText})分?)?(?:到|至|-|—|~)(上午|早上|中午|下午|晚上|今晚|凌晨)?(${hourText})点(半|(${hourText})分?)?`),
  )
  if (textRangeMatch) {
    const startHour = chineseNumberToNumber(textRangeMatch[2])
    const startMinute =
      textRangeMatch[3] === '半'
        ? 30
        : chineseNumberToNumber(textRangeMatch[4] ?? '0')
    const endHour = chineseNumberToNumber(textRangeMatch[6])
    const endMinute =
      textRangeMatch[7] === '半'
        ? 30
        : chineseNumberToNumber(textRangeMatch[8] ?? '0')

    if (
      startHour !== null &&
      startMinute !== null &&
      endHour !== null &&
      endMinute !== null
    ) {
      const range = buildTimeRange(
        {
          period: textRangeMatch[1],
          hour: startHour,
          minute: startMinute,
        },
        {
          period: textRangeMatch[5],
          hour: endHour,
          minute: endMinute,
        },
        textRangeMatch[0],
      )
      if (range) {
        return range
      }
    }
  }

  const clockMatch = text.match(/([01]?\d|2[0-3])[:：]([0-5]\d)/)
  if (clockMatch) {
    const time = `${clockMatch[1].padStart(2, '0')}:${clockMatch[2]}`
    return { startTime: time, timeLabel: time, matchedText: clockMatch[0] }
  }

  const timeMatch = text.match(
    new RegExp(`(上午|早上|中午|下午|晚上|今晚|凌晨)?(${hourText})点(半|(${hourText})分?)?`),
  )
  if (!timeMatch) {
    return null
  }

  const hour = chineseNumberToNumber(timeMatch[2])
  const minute = timeMatch[3] === '半' ? 30 : chineseNumberToNumber(timeMatch[4] ?? '0')
  if (hour === null || minute === null) {
    return null
  }

  const time = normalizeTime(hour, minute, timeMatch[1])
  return time ? { startTime: time, timeLabel: time, matchedText: timeMatch[0] } : null
}

function inferEventType(text: string): EventType {
  if (text.includes('课') || text.includes('课程')) {
    return 'course'
  }
  if (text.includes('工作') || text.includes('会议') || text.includes('面试')) {
    return 'work'
  }
  if (text.includes('提醒')) {
    return 'reminder'
  }
  return 'schedule'
}

function cleanTitle(text: string, dateText?: string, timeText?: string): string {
  let title = text

  if (dateText) {
    title = title.replace(dateText, '')
  }
  if (timeText) {
    title = title.replace(timeText, '')
  }

  return title
    .replace(/(\d{4})年(\d{1,2})月(\d{1,2})(?:日|号)?/g, '')
    .replace(/\d{1,2}月\d{1,2}(?:日|号)/g, '')
    .replace(/(下周|下星期|下礼拜)[日天一二三四五六]|(?:周|星期|礼拜)[日天一二三四五六]/g, '')
    .replace(/今天|明天|后天/g, '')
    .replace(/(上午|早上|中午|下午|晚上|今晚|凌晨)?([01]?\d|2[0-3])[:：]([0-5]\d)(?:到|至|-|—|~)(上午|早上|中午|下午|晚上|今晚|凌晨)?([01]?\d|2[0-3])[:：]([0-5]\d)/g, '')
    .replace(/(上午|早上|中午|下午|晚上|今晚|凌晨)?[零〇一二两三四五六七八九十\d]{1,3}点(半|[零〇一二两三四五六七八九十\d]{1,3}分?)?(?:到|至|-|—|~)(上午|早上|中午|下午|晚上|今晚|凌晨)?[零〇一二两三四五六七八九十\d]{1,3}点(半|[零〇一二两三四五六七八九十\d]{1,3}分?)?/g, '')
    .replace(/([01]?\d|2[0-3])[:：]([0-5]\d)/g, '')
    .replace(/(上午|早上|中午|下午|晚上|今晚|凌晨)?[零〇一二两三四五六七八九十\d]{1,3}点(半|[零〇一二两三四五六七八九十\d]{1,3}分?)?/g, '')
    .replace(/帮我记|记录一下|记一下|提醒我|提醒|添加|新增|创建|安排|删除|取消|给我|记得/g, '')
    .replace(/有一场|有场|一场|有一个|有个|一个|有一次|有次|一次|有一件|有件|一件|需要|要/g, '')
    .replace(/日程|事项|事件|的|一下|我|请|帮我|给我/g, '')
    .replace(/[，。,.！!？?\s]/g, '')
    .trim()
}

function parseCountdownTitle(text: string): string {
  return text
    .replace(/^距离/, '')
    .replace(/还有几天$/, '')
    .replace(/还剩几天$/, '')
    .replace(/还有多少天$/, '')
    .replace(/还剩多少天$/, '')
    .trim()
}

function hasAddIntent(text: string): boolean {
  return ADD_WORDS.some((word) => text.includes(word))
}

function isSummaryDayCommand(text: string, hasExplicitDate: boolean): boolean {
  if (/总结.*(今天|明天|后天|日程|安排|\d{1,2}月\d{1,2}(?:日|号)|\d{4}年\d{1,2}月\d{1,2})/.test(text)) {
    return true
  }
  if (/(日程总结|安排总结|忙多久|总共要忙多久)/.test(text) && hasExplicitDate) {
    return true
  }
  return false
}

function parseCategoryDateAdd(
  text: string,
  resolvedDate: ReturnType<typeof resolveDate>,
): ParsedVoiceCommand | null {
  if (!/(拖进|拖到|加入|放进|放到).*(文件夹|分类)/.test(text)) {
    return null
  }

  if (!resolvedDate.explicit) {
    return {
      intent: 'unknown',
      rawText: text,
      reason: '没有识别到要加入分类的日期',
    }
  }

  const match = text.match(/(?:拖进|拖到|加入|放进|放到)(.+?)(?:文件夹|分类|里面|中)?$/)
  const categoryName = match?.[1]
    ?.replace(/文件夹|分类|里面|中|里/g, '')
    .trim()

  if (!categoryName) {
    return {
      intent: 'unknown',
      rawText: text,
      reason: '没有识别到分类名称',
    }
  }

  return {
    intent: 'category_date_add',
    rawText: text,
    date: resolvedDate.date,
    dateLabel: resolvedDate.label,
    categoryName,
  }
}

export function parseVoiceCommand(input: string): ParsedVoiceCommand {
  const rawText = input.trim()
  const text = rawText.replace(/\s+/g, '')
  const resolvedDate = resolveDate(text)
  const parsedTime = parseTime(text)

  if (!text) {
    return { intent: 'unknown', rawText, reason: '没有识别到语音内容' }
  }

  const categoryDateCommand = parseCategoryDateAdd(text, resolvedDate)
  if (categoryDateCommand) {
    return {
      ...categoryDateCommand,
      rawText,
    }
  }

  if (/距离.+(还有|还剩)(几|多少)天/.test(text)) {
    return {
      intent: 'countdown_query',
      rawText,
      title: parseCountdownTitle(text),
    }
  }

  if (/总结.*(这周|本周|未来七天|未来7天)|我这周有什么安排/.test(text)) {
    return { intent: 'summary_week', rawText }
  }

  if (isSummaryDayCommand(text, resolvedDate.explicit)) {
    return {
      intent: 'summary_day',
      rawText,
      date: resolvedDate.date,
      dateLabel: resolvedDate.label,
    }
  }

  if (/(现在)?几点|几点了|当前时间|现在时间|播报时间/.test(text)) {
    return { intent: 'time', rawText }
  }

  if (/(删除|取消)/.test(text)) {
    const title = cleanTitle(text, resolvedDate.matchedText, parsedTime?.matchedText)
    return {
      intent: 'delete',
      rawText,
      date: resolvedDate.date,
      dateLabel: resolvedDate.label,
      title,
      titleKeyword: title || undefined,
      startTime: parsedTime?.startTime,
      timeLabel: parsedTime?.timeLabel,
    }
  }

  if (/(查询|查看|看看|有什么安排|有什么日程|安排是什么|日程是什么)/.test(text)) {
    return {
      intent: 'query',
      rawText,
      date: resolvedDate.date,
      dateLabel: resolvedDate.label,
    }
  }

  if (hasAddIntent(text)) {
    const startTime = parsedTime?.startTime ?? '09:00'
    const title = cleanTitle(text, resolvedDate.matchedText, parsedTime?.matchedText)

    if (!title) {
      return { intent: 'unknown', rawText, reason: '没有识别到日程标题' }
    }

    return {
      intent: 'add',
      rawText,
      date: resolvedDate.date,
      dateLabel: resolvedDate.label,
      title,
      startTime,
      endTime: parsedTime?.endTime,
      timeLabel: parsedTime?.timeLabel ?? startTime,
      eventType: inferEventType(text),
    }
  }

  return { intent: 'unknown', rawText, reason: '暂时无法识别这条语音指令' }
}
