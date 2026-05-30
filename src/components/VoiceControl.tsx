import { useEffect, useRef, useState } from 'react'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition.ts'
import type { ScheduleSummary } from '../utils/scheduleSummary.ts'
import { getDaysBetweenToday } from '../utils/date.ts'
import {
  addDateToCategory,
  addEvent,
  deleteEvent,
  getCategories,
  getCountdowns,
  getDatesByCategory,
  getEventsByDate,
} from '../utils/storage.ts'
import { summarizeDay, summarizeNextSevenDays } from '../utils/scheduleSummary.ts'
import { parseVoiceCommand } from '../utils/voiceCommandParser.ts'

type VoiceControlProps = {
  onCalendarChange?: () => void
  onCategoryChange?: () => void
}

type ExecutionFeedback = {
  title: string
  message: string
  summary?: ScheduleSummary
}

const ASSISTANT_SUGGESTIONS: Record<string, string> = {
  考试: '建议创建倒计时并安排复习。',
  比赛: '建议创建倒计时气泡。',
  面试: '建议提前准备简历和自我介绍。',
  纪念日: '建议提前三天提醒准备礼物。',
  生日: '建议提前准备祝福或礼物。',
}

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 1
  utterance.pitch = 1
  window.speechSynthesis.speak(utterance)
}

function getAssistantSuggestion(title: string): string | undefined {
  const keyword = Object.keys(ASSISTANT_SUGGESTIONS).find((item) =>
    title.includes(item),
  )
  return keyword ? ASSISTANT_SUGGESTIONS[keyword] : undefined
}

function formatEventsForSpeech(dateLabel: string, events: ReturnType<typeof getEventsByDate>) {
  if (events.length === 0) {
    return `${dateLabel}暂无日程。`
  }

  const items = events
    .slice(0, 6)
    .map((event) => `${event.startTime} ${event.title}`)
    .join('；')
  return `${dateLabel}共有 ${events.length} 项日程：${items}。`
}

function formatCountdownResult(title: string, targetDate: string): string {
  const days = getDaysBetweenToday(targetDate)
  if (days === null) {
    return `${title}的日期无效。`
  }
  if (days === 0) {
    return `${title}就是今天。`
  }
  if (days > 0) {
    return `距离${title}还有 ${days} 天。`
  }
  return `${title}已经过去 ${Math.abs(days)} 天。`
}

export default function VoiceControl({
  onCalendarChange,
  onCategoryChange,
}: VoiceControlProps) {
  const {
    transcript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
  } = useSpeechRecognition()
  const [feedback, setFeedback] = useState<ExecutionFeedback | null>(null)
  const lastExecutedRef = useRef('')

  const setAndSpeak = (nextFeedback: ExecutionFeedback) => {
    setFeedback(nextFeedback)
    speak(nextFeedback.message)
  }

  const handleExecuteCommand = (text: string) => {
    const command = parseVoiceCommand(text)

    if (
      command.intent === 'category_date_add' &&
      command.date &&
      command.dateLabel &&
      command.categoryName
    ) {
      const categories = getCategories()
      const category = categories.find(
        (item) =>
          item.name === command.categoryName ||
          item.name.includes(command.categoryName ?? '') ||
          command.categoryName?.includes(item.name),
      )

      if (!category) {
        const message = `没有找到${command.categoryName}分类，请先创建这个分类。`
        setAndSpeak({ title: '分类未找到', message })
        return
      }

      const alreadyLinked = getDatesByCategory(category.id).includes(command.date)
      if (!alreadyLinked) {
        addDateToCategory(category.id, command.date)
        onCategoryChange?.()
      }

      const message = alreadyLinked
        ? `${command.dateLabel}已经在${category.name}文件夹中了。`
        : `已将${command.dateLabel}加入${category.name}文件夹。`
      setAndSpeak({ title: alreadyLinked ? '已存在' : '加入成功', message })
      return
    }

    if (command.intent === 'summary_day' && command.date) {
      const summary = summarizeDay(command.date, command.dateLabel)
      setAndSpeak({
        title: summary.title,
        message: summary.speechText,
        summary,
      })
      return
    }

    if (command.intent === 'summary_week') {
      const summary = summarizeNextSevenDays()
      setAndSpeak({
        title: summary.title,
        message: summary.speechText,
        summary,
      })
      return
    }

    if (command.intent === 'countdown_query') {
      const queryTitle = command.title ?? ''
      const countdown = getCountdowns().find(
        (item) => item.title.includes(queryTitle) || queryTitle.includes(item.title),
      )
      const message = countdown
        ? formatCountdownResult(countdown.title, countdown.targetDate)
        : `没有找到和“${queryTitle || '这个事项'}”匹配的倒计时。`
      setAndSpeak({ title: '倒计时查询', message })
      return
    }

    if (command.intent === 'add' && command.date && command.title && command.startTime) {
      addEvent({
        title: command.title,
        description: `由语音指令创建：${command.rawText}`,
        date: command.date,
        startTime: command.startTime,
        endTime: command.endTime,
        type: command.eventType ?? 'schedule',
        categoryId: undefined,
        reminderEnabled: true,
      })

      const suggestion = getAssistantSuggestion(command.title)
      const message = `已为你添加${command.dateLabel ?? command.date}${command.timeLabel ?? command.startTime}的${command.title}提醒${
        suggestion ? `。助手建议：${suggestion}` : '。'
      }`
      setAndSpeak({ title: '添加成功', message })
      onCalendarChange?.()
      return
    }

    if (command.intent === 'query' && command.date) {
      const events = getEventsByDate(command.date)
      const message = formatEventsForSpeech(command.dateLabel ?? command.date, events)
      setAndSpeak({ title: '日程查询', message })
      return
    }

    if (command.intent === 'delete' && command.date) {
      const events = getEventsByDate(command.date)
      const titleKeyword = command.titleKeyword ?? command.title
      const matchedEvent = events.find((event) => {
        const titleMatched = titleKeyword ? event.title.includes(titleKeyword) : true
        const timeMatched = command.startTime ? event.startTime === command.startTime : true
        return titleMatched && timeMatched
      })
      const deleted = matchedEvent ? deleteEvent(matchedEvent.id) : false
      const message =
        deleted && matchedEvent
          ? `已删除${command.dateLabel ?? command.date}${matchedEvent.startTime}的${matchedEvent.title}。`
          : `没有找到可删除的${command.dateLabel ?? command.date}日程。`
      setAndSpeak({ title: deleted ? '删除成功' : '删除失败', message })
      if (deleted) {
        onCalendarChange?.()
      }
      return
    }

    if (command.intent === 'time') {
      const now = new Date()
      const hour = String(now.getHours()).padStart(2, '0')
      const minute = String(now.getMinutes()).padStart(2, '0')
      const message = `现在是 ${hour}:${minute}。`
      setAndSpeak({ title: '当前时间', message })
      return
    }

    const message = command.reason
      ? `无法识别指令：${command.reason}`
      : '暂时没有识别到可执行的语音指令。你可以说：把5月8日加入学习分类。'
    setAndSpeak({ title: '未识别指令', message })
  }

  const executeTranscript = () => {
    const text = transcript.trim()
    if (!text) {
      const message = '请先说出或输入一条语音指令。'
      setAndSpeak({ title: '等待指令', message })
      return
    }

    lastExecutedRef.current = text
    handleExecuteCommand(text)
  }

  const handleToggleListening = () => {
    if (isListening) {
      stopListening()
      return
    }

    setFeedback(null)
    lastExecutedRef.current = ''
    startListening()
  }

  useEffect(() => {
    const text = transcript.trim()
    if (isListening || !text || lastExecutedRef.current === text) {
      return
    }

    lastExecutedRef.current = text
    handleExecuteCommand(text)
  }, [isListening, transcript])

  return (
    <section className="voice-control" aria-label="语音输入">
      <div className="voice-control-header">
        <h2 className="section-title">语音输入</h2>
        <p className="voice-control-desc">点击按钮开始说话，识别结果和执行反馈会显示在下方</p>
      </div>

      {!isSupported ? (
        <p className="voice-control-unsupported">
          当前浏览器不支持语音识别，请使用 Chrome 或 Edge 体验此功能。
        </p>
      ) : (
        <>
          <div className="voice-actions">
            <button
              type="button"
              className={`voice-button voice-control-btn${isListening ? ' voice-button--listening voice-control-btn--listening' : ''}`}
              onClick={handleToggleListening}
            >
              {isListening ? '正在听... 点击停止' : '开始语音输入'}
            </button>
            <button
              type="button"
              className="voice-execute-button"
              onClick={executeTranscript}
              disabled={!transcript.trim()}
            >
              执行语音指令
            </button>
          </div>

          {error && <p className="voice-control-error voice-error">{error}</p>}

          <div className="voice-control-result voice-result">
            <span className="voice-control-result-label">识别结果</span>
            <p className="voice-control-transcript">
              {transcript || (isListening ? '请开始说话...' : '暂无识别内容')}
            </p>
          </div>

          <div className="voice-control-feedback voice-command-result" aria-live="polite">
            <span className="voice-control-result-label">执行反馈</span>
            {feedback ? (
              <article className="voice-feedback-card">
                <h3>{feedback.title}</h3>
                {feedback.summary ? (
                  <>
                    <div className="voice-summary-stats">
                      <span>{feedback.summary.eventCount} 项日程</span>
                      <span>预计 {feedback.summary.totalDurationText}</span>
                      <span>{feedback.summary.dateRange}</span>
                    </div>
                    {feedback.summary.emptyMessage ? (
                      <p>{feedback.summary.emptyMessage}</p>
                    ) : (
                      <>
                        <ul className="voice-summary-list">
                          {feedback.summary.mainItems.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                        <div className="voice-summary-highlight">
                          <strong>重点事项</strong>
                          {feedback.summary.highlights.length > 0 ? (
                            <ul>
                              {feedback.summary.highlights.map((item) => (
                                <li key={`${item.keyword}-${item.title}`}>
                                  {item.title}：{item.message}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>暂未识别到重点事项。</p>
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p>{feedback.message}</p>
                )}
              </article>
            ) : (
              <p className="voice-control-feedback-empty">等待语音指令执行。</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
