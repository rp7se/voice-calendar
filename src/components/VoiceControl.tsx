import { useState } from 'react'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { addEvent, deleteEvent, getEventsByDate } from '../utils/storage'
import { parseVoiceCommand } from '../utils/voiceCommandParser'

interface VoiceControlProps {
  onCalendarChange?: () => void
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) {
    return
  }

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 1
  utterance.pitch = 1

  window.speechSynthesis.speak(utterance)
}

function formatTimeResult() {
  const now = new Date()
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  return `现在是 ${hour}:${minute}`
}

export default function VoiceControl({ onCalendarChange }: VoiceControlProps) {
  const {
    transcript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
  } = useSpeechRecognition()

  const [commandResult, setCommandResult] = useState('')

  const handleToggleListening = () => {
    if (isListening) {
      stopListening()
      return
    }

    setCommandResult('')
    startListening()
  }

  const handleExecuteCommand = () => {
    const command = parseVoiceCommand(transcript)

    if (command.intent === 'unknown') {
      const message = `无法识别指令：${command.reason}`
      setCommandResult(message)
      speak(message)
      return
    }

    if (command.intent === 'time') {
      const message = formatTimeResult()
      setCommandResult(message)
      speak(message)
      return
    }

    if (command.intent === 'add') {
      addEvent({
        title: command.title,
        description: '',
        date: command.date,
        startTime: command.startTime,
        endTime: undefined,
        type: 'schedule',
        categoryId: undefined,
        reminderEnabled: true,
      })

      const message = `已为你添加${command.dateLabel}${command.timeLabel}的${command.title}提醒`
      setCommandResult(message)
      speak(message)
      onCalendarChange?.()
      return
    }

    if (command.intent === 'query') {
      const events = getEventsByDate(command.date)

      if (events.length === 0) {
        const message = `${command.dateLabel}暂无安排`
        setCommandResult(message)
        speak(message)
        return
      }

      const detail = events
        .map((event) => `${event.startTime} ${event.title}`)
        .join('；')

      const message = `${command.dateLabel}共有 ${events.length} 项安排：${detail}`
      setCommandResult(message)
      speak(message)
      return
    }

    if (command.intent === 'delete') {
      const events = getEventsByDate(command.date)

      const matchedEvent = events.find((event) => {
        const timeMatched = command.startTime ? event.startTime === command.startTime : true
        const titleMatched = command.titleKeyword
          ? event.title.includes(command.titleKeyword)
          : true

        return timeMatched && titleMatched
      })

      if (!matchedEvent) {
        const message = `没有找到${command.dateLabel}对应的日程`
        setCommandResult(message)
        speak(message)
        return
      }

      deleteEvent(matchedEvent.id)

      const message = `已删除${command.dateLabel}${matchedEvent.startTime}的${matchedEvent.title}`
      setCommandResult(message)
      speak(message)
      onCalendarChange?.()
    }
  }

  return (
    <section className="voice-control">
      <div className="voice-control__header">
        <div>
          <p className="section-eyebrow">🎙️ 语音助手</p>
          <h2>用语音管理你的日程</h2>
        </div>
        <button
          className={`voice-button ${isListening ? 'voice-button--listening' : ''}`}
          type="button"
          onClick={handleToggleListening}
          disabled={!isSupported}
        >
          {isListening ? '正在听...点击停止' : '开始语音输入'}
        </button>
      </div>

      {!isSupported && (
        <p className="voice-tip">当前浏览器不支持语音识别，请使用 Chrome 浏览器测试。</p>
      )}

      {error && <p className="voice-error">{error}</p>}

      <div className="voice-result">
        <span>识别结果</span>
        <p>{transcript || '可以试试说：“明天下午三点提醒我面试”'}</p>
      </div>

      <button
        className="voice-execute-button"
        type="button"
        onClick={handleExecuteCommand}
        disabled={!transcript.trim()}
      >
        执行语音指令
      </button>

      {commandResult && (
        <div className="voice-command-result">
          <span>执行反馈</span>
          <p>{commandResult}</p>
        </div>
      )}
    </section>
  )
}