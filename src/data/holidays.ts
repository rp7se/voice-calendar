import type { HolidayInfo } from '../types/calendar.ts'

/**
 * 静态节日数据。
 * 固定公历节日使用 MM-DD；农历节日（春节、端午、中秋）每年日期不同，
 * 当前以 2026 年为例配置 YYYY-MM-DD，后续可替换为农历换算逻辑。
 */
export const HOLIDAYS: HolidayInfo[] = [
  { date: '01-01', name: '元旦', type: 'public' },
  { date: '02-14', name: '情人节', type: 'custom' },
  { date: '05-01', name: '劳动节', type: 'public' },
  { date: '06-01', name: '儿童节', type: 'public' },
  { date: '10-01', name: '国庆节', type: 'public' },
  { date: '12-25', name: '圣诞节', type: 'custom' },
  // 农历节日静态示例（2026 年）
  { date: '2026-02-17', name: '春节', type: 'traditional' },
  { date: '2026-06-19', name: '端午节', type: 'traditional' },
  { date: '2026-09-25', name: '中秋节', type: 'traditional' },
]
