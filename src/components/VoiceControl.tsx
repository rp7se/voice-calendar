import { useEffect, useMemo, useRef, useState } from 'react'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition.ts'
import type { ScheduleSummary } from '../utils/scheduleSummary.ts'
import { getDaysBetweenToday } from '../utils/date.ts'
import {
  createEvent,
  deleteEvent,
  getEventErrorMessage,
  getEventsByDate,
} from '../services/eventDataSource.ts'
import {
  addDateToCategory,
  getCountdowns,
  getDatesByCategory,
} from '../utils/storage.ts'
import { summarizeDay, summarizeNextSevenDays } from '../utils/scheduleSummary.ts'
import { parseVoiceCommand } from '../utils/voiceCommandParser.ts'
import type { EventCategory } from '../types/calendar.ts'

type VoiceControlProps = {
  categories: EventCategory[]
  onCalendarChange?: () => void
  onCategoryChange?: () => void
  listenSignal?: number
  textCommand?: VoiceExternalCommand | null
  onRuntimeChange?: (status: VoiceRuntimeStatus) => void
}

type ExecutionFeedback = {
  title: string
  message: string
  summary?: ScheduleSummary
}

export type VoiceRuntimePhase = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

export type VoiceRuntimeStatus = {
  phase: VoiceRuntimePhase
  transcript: string
  isListening: boolean
  isSupported: boolean
  wakeWordEnabled: boolean
  error: string | null
  feedbackTitle?: string
}

export type VoiceExternalCommand = {
  id: number
  text: string
}

const WAKE_WORD = '小历小历'

const WAKE_WORD_ALIASES = [
  '小历小历',
  '小丽小丽',
  '小李小李',
  '小力小力',
  '小利小利',
  '小粒小粒',
  '小璃小璃',
  '小历',
  '小丽',
  '小李',
  '小力',
  '小利',
  '小粒',
  '小璃',
]

const ASSISTANT_SUGGESTIONS: Record<string, string> = {
  考试: '建议创建倒计时并安排复习。',
  比赛: '建议创建倒计时气泡。',
  面试: '建议提前准备简历和自我介绍。',
  纪念日: '建议提前三天提醒准备礼物。',
  生日: '建议提前准备祝福或礼物。',
}

function speak(text: string, onStart?: () => void, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.()
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 1
  utterance.pitch = 1
  utterance.onstart = () => onStart?.()
  utterance.onend = () => onEnd?.()
  utterance.onerror = () => onEnd?.()
  window.speechSynthesis.speak(utterance)
}

function stripWakeWord(text: string): { matched: boolean; commandText: string } {
  const compactText = text.replace(/[\s，。,.！!？?、；;：:]/g, '')
  const matchedAlias = WAKE_WORD_ALIASES.find((alias) => compactText.includes(alias))

  if (!matchedAlias) {
    return {
      matched: false,
      commandText: text,
    }
  }

  const aliasIndex = compactText.indexOf(matchedAlias)
  const commandText = compactText.slice(0, aliasIndex) + compactText.slice(aliasIndex + matchedAlias.length)
  return {
    matched: true,
    commandText: commandText.trim(),
  }
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
  categories,
  onCalendarChange,
  onCategoryChange,
  listenSignal = 0,
  textCommand = null,
  onRuntimeChange,
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
  const [wakeWordEnabled] = useState(false)
  const [runtimePhase, setRuntimePhase] = useState<VoiceRuntimePhase>('idle')
  const lastExecutedRef = useRef('')
  const lastListenSignalRef = useRef(listenSignal)
  const lastTextCommandIdRef = useRef(textCommand?.id ?? 0)
  const executeCommandRef = useRef<(text: string) => void>(() => undefined)
  const toggleListeningRef = useRef<() => void>(() => undefined)

  const setAndSpeak = (nextFeedback: ExecutionFeedback) => {
    setFeedback(nextFeedback)
    setRuntimePhase('processing')
    speak(
      nextFeedback.message,
      () => setRuntimePhase('speaking'),
      () => setRuntimePhase('idle'),
    )
  }

  const normalizeCommandText = (text: string): string | null => {
    const commandText = text.trim()
    if (!wakeWordEnabled) {
      return commandText
    }

    const wakeWordResult = stripWakeWord(commandText)
    if (!wakeWordResult.matched) {
      const message = `请先说出唤醒词：${WAKE_WORD}`
      setAndSpeak({ title: '等待唤醒词', message })
      return null
    }

    if (!wakeWordResult.commandText) {
      const message = '已听到唤醒词，请继续说出具体指令。'
      setAndSpeak({ title: '等待指令', message })
      return null
    }

    return wakeWordResult.commandText
  }

  const handleExecuteCommand = async (text: string) => {
    const commandText = normalizeCommandText(text)
    if (commandText === null) {
      return
    }

    const command = parseVoiceCommand(commandText)

    if (
      command.intent === 'category_date_add' &&
      command.date &&
      command.dateLabel &&
      command.categoryName
    ) {
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
      try {
        await createEvent({
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
      } catch (error) {
        setAndSpeak({
          title: '添加失败',
          message: getEventErrorMessage(error, '日程保存失败，请稍后重试。'),
        })
      }
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
      let deleted = false
      if (matchedEvent) {
        try {
          deleted = await deleteEvent(matchedEvent.id)
        } catch (error) {
          setAndSpeak({
            title: '删除失败',
            message: getEventErrorMessage(error, '日程删除失败，请稍后重试。'),
          })
          return
        }
      }
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
      : '暂时没有识别到可执行的语音指令。你可以说：明天9点提醒我考试。'
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
    setRuntimePhase('idle')
    lastExecutedRef.current = ''
    startListening()
  }

  useEffect(() => {
    executeCommandRef.current = handleExecuteCommand
    toggleListeningRef.current = handleToggleListening
  })

  const runtimeStatus = useMemo<VoiceRuntimeStatus>(() => {
    const phase: VoiceRuntimePhase = error
      ? 'error'
      : isListening
        ? 'listening'
        : runtimePhase

    return {
      phase,
      transcript,
      isListening,
      isSupported,
      wakeWordEnabled,
      error,
      feedbackTitle: feedback?.title,
    }
  }, [error, feedback?.title, isListening, isSupported, runtimePhase, transcript, wakeWordEnabled])

  useEffect(() => {
    onRuntimeChange?.(runtimeStatus)
  }, [onRuntimeChange, runtimeStatus])

  useEffect(() => {
    if (listenSignal === lastListenSignalRef.current) {
      return
    }

    lastListenSignalRef.current = listenSignal
    toggleListeningRef.current()
  }, [listenSignal])

  useEffect(() => {
    if (!textCommand || textCommand.id === lastTextCommandIdRef.current) {
      return
    }

    lastTextCommandIdRef.current = textCommand.id
    if (isListening) {
      stopListening()
    }
    lastExecutedRef.current = textCommand.text.trim()
    executeCommandRef.current(textCommand.text)
  }, [isListening, stopListening, textCommand])

  useEffect(() => {
    const text = transcript.trim()
    if (isListening || !text || lastExecutedRef.current === text) {
      return
    }

    lastExecutedRef.current = text
    executeCommandRef.current(text)
  }, [isListening, transcript, wakeWordEnabled])

  return (
    <section className="voice-control" aria-label="语音输入">
      <div className="voice-control-header">
        <h2 className="section-title">语音状态</h2>
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

          {(isListening || transcript) && (
            <div className="voice-control-result voice-result">
              <span className="voice-control-result-label">识别结果</span>
              <p className="voice-control-transcript">
                {transcript || (isListening ? '正在聆听' : '')}
              </p>
            </div>
          )}

          {feedback && (
            <div className="voice-control-feedback voice-command-result" aria-live="polite">
              <span className="voice-control-result-label">执行反馈</span>
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
            </div>
          )}
        </>
      )}
    </section>
  )
}
