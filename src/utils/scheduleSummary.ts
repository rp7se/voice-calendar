import type { CalendarEvent } from '../types/calendar.ts'
import { formatDate } from './date.ts'
import { getEvents, getEventsByDate } from './storage.ts'

export type ScheduleHighlight = {
  keyword: string
  title: string
  message: string
}

export type ScheduleSummary = {
  title: string
  dateRange: string
  eventCount: number
  totalDurationMinutes: number
  totalDurationText: string
  mainItems: string[]
  highlights: ScheduleHighlight[]
  emptyMessage?: string
  speechText: string
}

const IMPORTANT_KEYWORDS: Record<string, string> = {
  考试: '有考试安排，建议提前规划复习时间。',
  比赛: '有比赛安排，记得预留准备和到场时间。',
  面试: '有面试安排，建议提前准备简历和自我介绍。',
  会议: '有会议安排，可以提前整理议题和资料。',
  纪念日: '有纪念日安排，建议提前准备心意。',
  生日: '有生日安排，建议提前准备祝福或礼物。',
}

function parseTimeToMinutes(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) {
    return null
  }

  return hours * 60 + minutes
}

export function calculateTotalDuration(events: CalendarEvent[]): number {
  return events.reduce((total, event) => {
    if (!event.endTime) {
      return total
    }

    const start = parseTimeToMinutes(event.startTime)
    const end = parseTimeToMinutes(event.endTime)
    if (start === null || end === null || end <= start) {
      return total
    }

    return total + end - start
  }, 0)
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) {
    return '暂未统计到明确耗时'
  }

  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (hours > 0 && restMinutes > 0) {
    return `${hours} 小时 ${restMinutes} 分钟`
  }
  if (hours > 0) {
    return `${hours} 小时`
  }
  return `${restMinutes} 分钟`
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date)
    if (dateDiff !== 0) {
      return dateDiff
    }
    return a.startTime.localeCompare(b.startTime)
  })
}

function formatEventItem(event: CalendarEvent): string {
  const timeRange = event.endTime
    ? `${event.startTime}-${event.endTime}`
    : event.startTime
  return `${event.date} ${timeRange} ${event.title}`
}

function collectHighlights(events: CalendarEvent[]): ScheduleHighlight[] {
  const highlights: ScheduleHighlight[] = []

  for (const event of events) {
    const text = `${event.title} ${event.description}`.toLowerCase()
    for (const [keyword, message] of Object.entries(IMPORTANT_KEYWORDS)) {
      if (text.includes(keyword.toLowerCase())) {
        highlights.push({
          keyword,
          title: event.title,
          message,
        })
        break
      }
    }
  }

  return highlights
}

function buildSummary(title: string, dateRange: string, events: CalendarEvent[]): ScheduleSummary {
  const sortedEvents = sortEvents(events)
  const eventCount = sortedEvents.length
  const totalDurationMinutes = calculateTotalDuration(sortedEvents)
  const totalDurationText = formatDuration(totalDurationMinutes)
  const mainItems = sortedEvents.slice(0, 6).map(formatEventItem)
  const highlights = collectHighlights(sortedEvents)

  if (eventCount === 0) {
    const emptyMessage = `${title}暂无日程，可以轻松安排自己的时间。`
    return {
      title,
      dateRange,
      eventCount,
      totalDurationMinutes,
      totalDurationText,
      mainItems,
      highlights,
      emptyMessage,
      speechText: emptyMessage,
    }
  }

  const itemText = mainItems.length > 0 ? `主要事项有：${mainItems.join('；')}。` : ''
  const highlightText =
    highlights.length > 0
      ? `重点提醒：${highlights.map((item) => `${item.title}，${item.message}`).join('；')}`
      : '暂未识别到考试、比赛、面试、会议、纪念日或生日等重点事项。'

  return {
    title,
    dateRange,
    eventCount,
    totalDurationMinutes,
    totalDurationText,
    mainItems,
    highlights,
    speechText: `${title}共有 ${eventCount} 项日程，预计总耗时${totalDurationText}。${itemText}${highlightText}`,
  }
}

export function summarizeDay(date: string, dateLabel = date): ScheduleSummary {
  return buildSummary(`${dateLabel}的日程总结`, date, getEventsByDate(date))
}

export function summarizeNextSevenDays(): ScheduleSummary {
  const today = new Date()
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + index)
    return formatDate(date)
  })
  const dateSet = new Set(dates)
  const events = getEvents().filter((event) => dateSet.has(event.date))

  return buildSummary('未来七天的安排总结', `${dates[0]} 至 ${dates[6]}`, events)
}
