export type HistoryEvent = {
  year: number
  month: number
  day: number
  title: string
}

export const historyEvents: HistoryEvent[] = [
  { year: 1799, month: 7, day: 15, title: '罗塞塔石碑被发现' },
  { year: 1975, month: 7, day: 15, title: '阿波罗-联盟测试计划发射' },
  { year: 1983, month: 1, day: 1, title: 'ARPANET 切换至 TCP/IP' },
  { year: 1984, month: 1, day: 24, title: 'Macintosh 正式发布' },
  { year: 1879, month: 3, day: 14, title: '爱因斯坦出生' },
  { year: 1961, month: 4, day: 12, title: '加加林进入太空' },
  { year: 1975, month: 4, day: 4, title: 'Microsoft 创立' },
  { year: 1840, month: 5, day: 6, title: '黑便士邮票发行' },
  { year: 1851, month: 5, day: 1, title: '万国工业博览会开幕' },
  { year: 2007, month: 6, day: 29, title: '第一代 iPhone 发售' },
  { year: 1997, month: 7, day: 1, title: '香港回归' },
  { year: 1969, month: 7, day: 20, title: '阿波罗 11 号登月' },
  { year: 2008, month: 8, day: 8, title: '北京奥运会开幕' },
  { year: 1991, month: 8, day: 6, title: '万维网项目公开发布' },
  { year: 1957, month: 10, day: 4, title: 'Sputnik 1 发射' },
  { year: 1949, month: 10, day: 1, title: '中华人民共和国成立' },
  { year: 1989, month: 11, day: 9, title: '柏林墙开放' },
  { year: 1901, month: 12, day: 10, title: '首届诺贝尔奖颁发' },
  { year: 1903, month: 12, day: 17, title: '莱特兄弟首次动力飞行' },
  { year: 1968, month: 12, day: 24, title: '阿波罗 8 号绕月直播' },
]

export function getAmbientHistoryEvents(date: Date, limit = 8): HistoryEvent[] {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const matched = historyEvents.filter((event) => event.month === month && event.day === day)
  const fallbackStart = (month * 3 + day) % historyEvents.length
  const fallback = Array.from({ length: historyEvents.length }, (_, index) => {
    return historyEvents[(fallbackStart + index) % historyEvents.length]
  }).filter((event) => !matched.includes(event))

  return [...matched, ...fallback].slice(0, limit)
}
