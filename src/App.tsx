import CalendarView from './components/CalendarView.tsx'
import './App.css'

function App() {
  return (
    <main className="app">
      <header className="app-header">
        <h1>voice-calendar</h1>
        <p className="intro-desc">面向学习、工作和竞赛场景的语音日程管理系统</p>
      </header>

      <CalendarView />
    </main>
  )
}

export default App
