import { useState } from 'react'
import CalendarView from './components/CalendarView.tsx'
import CategoryPanel from './components/CategoryPanel.tsx'
import CountdownBubbleLayer from './components/CountdownBubbleLayer.tsx'
import CountdownPanel from './components/CountdownPanel.tsx'
import DayDetail from './components/DayDetail.tsx'
import VoiceControl from './components/VoiceControl.tsx'
import { formatDate } from './utils/date.ts'
import './App.css'

function App() {
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()))
  const [eventsVersion, setEventsVersion] = useState(0)
  const [categoriesVersion, setCategoriesVersion] = useState(0)
  const [countdownVersion, setCountdownVersion] = useState(0)

  const handleSelectDate = (date: Date) => {
    setSelectedDate(formatDate(date))
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

      <div className="main-layout">
        <div className="left-main">
          <CalendarView
            key={`calendar-${eventsVersion}`}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}  
          />
          <CountdownPanel onCountdownChange={handleCountdownChange} />
        </div>

        <aside className="right-sidebar">
          <CategoryPanel
            eventsVersion={eventsVersion}
            onCategoriesChange={handleCategoriesChange}
          />
          <DayDetail
            key={`day-${eventsVersion}`}
            compact
            selectedDate={selectedDate}
            onEventsChange={handleEventsChange}
            categoriesVersion={categoriesVersion}
          />
        </aside>
      </div>
    </main>
  )
}

export default App
