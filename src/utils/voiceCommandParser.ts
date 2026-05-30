
export interface AddVoiceCommand {
  intent: 'add'
  date: string
  startTime: string
  title: string
  dateLabel: string
  timeLabel: string
}

export interface QueryVoiceCommand {
  intent: 'query'
  date: string
  dateLabel: string
}

export interface DeleteVoiceCommand {
  intent: 'delete'
  date: string
  dateLabel: string
  startTime?: string
  timeLabel?: string
  titleKeyword?: string
}

export interface TimeVoiceCommand {
  intent: 'time'
}

export interface UnknownVoiceCommand {
  intent: 'unknown'
  reason: string
}

export type ParsedVoiceCommand =
  | AddVoiceCommand
  | QueryVoiceCommand
  | DeleteVoiceCommand
  | TimeVoiceCommand
  | UnknownVoiceCommand

const CHINESE_NUMBERS: Record<string, number> = {
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

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

interface RelativeDateResult {
    date: string
    dateLabel: string
  }
  
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
  
  function getNextWeekdayDate(targetWeekday: number): Date {
    const today = new Date()
    const currentWeekday = today.getDay()
  
    let diff = targetWeekday - currentWeekday
    if (diff <= 0) {
      diff += 7
    }
  
    const date = new Date(today)
    date.setDate(today.getDate() + diff)
  
    return date
  }
  
  function getDateInNextWeek(targetWeekday: number): Date {
    const today = new Date()
    const currentWeekday = today.getDay()
  
    const daysUntilNextMonday = ((1 - currentWeekday + 7) % 7) || 7
    const mondayOfNextWeek = new Date(today)
    mondayOfNextWeek.setDate(today.getDate() + daysUntilNextMonday)
  
    const date = new Date(mondayOfNextWeek)
    const offset = targetWeekday === 0 ? 6 : targetWeekday - 1
    date.setDate(mondayOfNextWeek.getDate() + offset)
  
    return date
  }

  function parseExplicitDate(text: string): RelativeDateResult | null {
    const match = text.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})(?:日|号)?/)
  
    if (!match) {
      return null
    }
  
    const today = new Date()
    const hasYear = Boolean(match[1])
    const year = hasYear ? Number(match[1]) : today.getFullYear()
    const month = Number(match[2])
    const day = Number(match[3])
  
    const date = new Date(year, month - 1, day)
  
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null
    }
  
    if (!hasYear) {
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  
      if (date < todayStart) {
        date.setFullYear(year + 1)
      }
    }
  
    return {
      date: formatDate(date),
      dateLabel: `${date.getMonth() + 1}月${date.getDate()}日`,
    }
  }
  
  function getRelativeDate(text: string): RelativeDateResult {
    const explicitDate = parseExplicitDate(text)
    if (explicitDate) {
        return explicitDate
    }
    const today = new Date()
  
    const nextWeekMatch = text.match(/下(?:个)?(?:周|星期|礼拜)([一二三四五六日天])/)
    if (nextWeekMatch) {
      const weekdayText = nextWeekMatch[1]
      const weekday = WEEKDAY_MAP[weekdayText]
  
      return {
        date: formatDate(getDateInNextWeek(weekday)),
        dateLabel: `下周${weekdayText}`,
      }
    }
  
    const weekMatch = text.match(/(?:这|本)?(?:周|星期|礼拜)([一二三四五六日天])/)
    if (weekMatch) {
      const weekdayText = weekMatch[1]
      const weekday = WEEKDAY_MAP[weekdayText]
  
      return {
        date: formatDate(getNextWeekdayDate(weekday)),
        dateLabel: `周${weekdayText}`,
      }
    }
  
    if (text.includes('后天')) {
      const date = new Date(today)
      date.setDate(today.getDate() + 2)
  
      return {
        date: formatDate(date),
        dateLabel: '后天',
      }
    }
  
    if (text.includes('明天')) {
      const date = new Date(today)
      date.setDate(today.getDate() + 1)
  
      return {
        date: formatDate(date),
        dateLabel: '明天',
      }
    }
  
    return {
      date: formatDate(today),
      dateLabel: '今天',
    }
  }

function parseChineseNumber(value: string) {
  if (/^\d+$/.test(value)) {
    return Number(value)
  }

  if (value === '十') {
    return 10
  }

  if (value.startsWith('十')) {
    const right = value.slice(1)
    return 10 + (CHINESE_NUMBERS[right] ?? 0)
  }

  if (value.endsWith('十')) {
    const left = value.slice(0, -1)
    return (CHINESE_NUMBERS[left] ?? 1) * 10
  }

  if (value.includes('十')) {
    const [left, right] = value.split('十')
    return (CHINESE_NUMBERS[left] ?? 1) * 10 + (CHINESE_NUMBERS[right] ?? 0)
  }

  return CHINESE_NUMBERS[value]
}

function parseTime(text: string) {
  const colonMatch = text.match(/(\d{1,2})[:：](\d{1,2})/)
  if (colonMatch) {
    const hour = Number(colonMatch[1])
    const minute = Number(colonMatch[2])
    return {
      startTime: `${pad(hour)}:${pad(minute)}`,
      timeLabel: `${hour}:${pad(minute)}`,
    }
  }

  const timeMatch = text.match(/([零〇一二两三四五六七八九十\d]{1,3})点(半)?/)
  if (!timeMatch) {
    return null
  }

  let hour = parseChineseNumber(timeMatch[1])
  const minute = timeMatch[2] ? 30 : 0

  if (hour === undefined || Number.isNaN(hour)) {
    return null
  }

  const isAfternoon = /下午|晚上|今晚|夜里/.test(text)
  const isNoon = /中午/.test(text)

  if ((isAfternoon || isNoon) && hour < 12) {
    hour += 12
  }

  if (hour >= 24) {
    return null
  }

  return {
    startTime: `${pad(hour)}:${pad(minute)}`,
    timeLabel: `${hour}:${pad(minute)}`,
  }
}

function cleanTitle(text: string) {
  return text
    .replace(/今天|明天|后天/g, '')
    .replace(/下(?:个)?(?:周|星期|礼拜)[一二三四五六日天]/g, '')
    .replace(/(?:这|本)?(?:周|星期|礼拜)[一二三四五六日天]/g, '')
    .replace(/(?:\d{4}年)?\d{1,2}月\d{1,2}(?:日|号)?/g, '')
    .replace(/上午|下午|晚上|今晚|早上|中午|凌晨|夜里/g, '')
    .replace(/[零〇一二两三四五六七八九十\d]{1,3}点半?/g, '')
    .replace(/\d{1,2}[:：]\d{1,2}/g, '')
    .replace(/帮我|请|记一下|记录一下|添加|新增|创建|提醒我|提醒|日程|安排|事项|事件/g, '')
    .replace(/删除|取消/g, '')
    .replace(/[，。,.！!？?的\s]/g, '')
    .trim()
}

export function parseVoiceCommand(rawText: string): ParsedVoiceCommand {
  const text = rawText.trim()

  if (!text) {
    return {
      intent: 'unknown',
      reason: '没有识别到语音内容',
    }
  }

  if (/现在几点|几点了|当前时间|播报时间/.test(text)) {
    return {
      intent: 'time',
    }
  }

  const { date, dateLabel } = getRelativeDate(text)

  if (/查看|查询|有什么安排|有什么日程|安排是什么|日程是什么/.test(text)) {
    return {
      intent: 'query',
      date,
      dateLabel,
    }
  }

  if (/删除|取消/.test(text)) {
    const time = parseTime(text)
    const titleKeyword = cleanTitle(text)

    return {
      intent: 'delete',
      date,
      dateLabel,
      startTime: time?.startTime,
      timeLabel: time?.timeLabel,
      titleKeyword: titleKeyword || undefined,
    }
  }

  if (/添加|新增|创建|提醒我|帮我记|记一下|记录一下/.test(text)) {
    const time = parseTime(text) ?? {
        startTime: '09:00',
        timeLabel: '09:00',
    }

    const title = cleanTitle(text)

    if (!title) {
      return {
        intent: 'unknown',
        reason: '没有识别到日程标题',
      }
    }

    return {
      intent: 'add',
      date,
      startTime: time.startTime,
      title,
      dateLabel,
      timeLabel: time.timeLabel,
    }
  }

  return {
    intent: 'unknown',
    reason: '暂时无法识别这条语音指令',
  }
}