import { useState } from 'react'
import CalendarView from './components/CalendarView.tsx'
import DayDetail from './components/DayDetail.tsx'
import { formatDate } from './utils/date.ts'
import './App.css'

function App() {
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()))
  const [eventsVersion, setEventsVersion] = useState(0)

  const handleSelectDate = (date: Date) => {
    setSelectedDate(formatDate(date))
  }

  const handleEventsChange = () => {
    setEventsVersion((version) => version + 1)
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>voice-calendar</h1>
        <p className="intro-desc">面向学习、工作和竞赛场景的语音日程管理系统</p>
      </header>

      <div className="app-main">
        <CalendarView
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          eventsVersion={eventsVersion}
        />
        <DayDetail selectedDate={selectedDate} onEventsChange={handleEventsChange} />
      </div>
    </main>
  )
}

export default App
