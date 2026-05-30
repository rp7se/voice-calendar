import { useState } from 'react'
import CalendarView from './components/CalendarView.tsx'
import CategoryPanel from './components/CategoryPanel.tsx'
import CountdownBubbleLayer from './components/CountdownBubbleLayer.tsx'
import CountdownPanel from './components/CountdownPanel.tsx'
import DayDetailModal from './components/DayDetailModal.tsx'
import VoiceControl from './components/VoiceControl.tsx'
import { formatDate } from './utils/date.ts'
import './App.css'

function App() {
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()))
  const [eventsVersion, setEventsVersion] = useState(0)
  const [categoriesVersion, setCategoriesVersion] = useState(0)
  const [countdownVersion, setCountdownVersion] = useState(0)
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false)

  const handleSelectDate = (date: Date) => {
    setSelectedDate(formatDate(date))
    setIsDayDetailOpen(true)
  }

  const handleEventsChange = () => {
    setEventsVersion((version) => version + 1)
  }

  const handleCategoriesChange = () => {
    setCategoriesVersion((version) => version + 1)
  }

  const handleCountdownChange = () => {
    setCountdownVersion((version) => version + 1)
  }

  return (
    <main className="app">
      <CountdownBubbleLayer refreshVersion={countdownVersion} />

      <header className="app-header">
        <h1>VoiceCalendar</h1>
        <p className="intro-desc">面向学习、工作和竞赛场景的语音日程管理系统</p>
      </header>

      <VoiceControl onCalendarChange={handleEventsChange} />
      <DayDetailModal
        selectedDate={selectedDate}
        isOpen={isDayDetailOpen}
        onClose={() => setIsDayDetailOpen(false)}
        onEventsChange={handleEventsChange}
        categoriesVersion={categoriesVersion}
      />

      <div className="main-layout">
        <div className="left-main">
          <CalendarView
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            eventsVersion={eventsVersion}
          />
          <CountdownPanel onCountdownChange={handleCountdownChange} />
        </div>

        <aside className="right-sidebar">
          <CategoryPanel
            eventsVersion={eventsVersion}
            onCategoriesChange={handleCategoriesChange}
          />
          <section className="day-detail-hint panel-card">
            <h2 className="section-title">日期详情</h2>
            <p>点击日历中的日期，查看和编辑当天事项。</p>
            <button type="button" onClick={() => setIsDayDetailOpen(true)}>
              打开 {selectedDate}
            </button>
          </section>
        </aside>
      </div>
    </main>
  )
}

export default App
