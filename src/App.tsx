import { useState } from 'react'
import AmbientBackground from './components/AmbientBackground.tsx'
import CalendarView from './components/CalendarView.tsx'
import CategoryPanel from './components/CategoryPanel.tsx'
import CountdownBubbleLayer from './components/CountdownBubbleLayer.tsx'
import CountdownPanel from './components/CountdownPanel.tsx'
import DayDetailModal from './components/DayDetailModal.tsx'
import VoiceControl from './components/VoiceControl.tsx'
import AppShell from './components/layout/AppShell.tsx'
import ContextPanel from './components/layout/ContextPanel.tsx'
import Sidebar, { type WorkspaceId } from './components/layout/Sidebar.tsx'
import Topbar from './components/layout/Topbar.tsx'
import { formatDate } from './utils/date.ts'
import './App.css'

const WORKSPACE_PLACEHOLDERS: Record<
  Exclude<WorkspaceId, 'calendar'>,
  {
    title: string
    description: string
  }
> = {
  today: {
    title: 'Today Workspace',
    description: 'Today 将在后续 PR 中扩展为今日概览；当前 PR 只建立工作区入口。',
  },
  tasks: {
    title: 'Tasks Workspace',
    description: 'Tasks 将在后续 PR 中实现任务视图；当前先保留导航位置。',
  },
  insights: {
    title: 'Insights Workspace',
    description: 'Insights 将在后续 PR 中承载时间分析和总结。',
  },
  settings: {
    title: 'Settings Workspace',
    description: 'Settings 将在后续 PR 中承载偏好设置。',
  },
}

function App() {
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()))
  const [eventsVersion, setEventsVersion] = useState(0)
  const [categoriesVersion, setCategoriesVersion] = useState(0)
  const [countdownVersion, setCountdownVersion] = useState(0)
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false)
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('calendar')

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

  const renderWorkspace = () => {
    if (activeWorkspace !== 'calendar') {
      const placeholder = WORKSPACE_PLACEHOLDERS[activeWorkspace]
      return (
        <section className="workspace-placeholder panel-card">
          <span className="workspace-placeholder-kicker">Coming Soon</span>
          <h2>{placeholder.title}</h2>
          <p>{placeholder.description}</p>
          <button type="button" onClick={() => setActiveWorkspace('calendar')}>
            返回 Calendar
          </button>
        </section>
      )
    }

    return (
      <div className="workspace-calendar">
        <div className="workspace-heading">
          <div>
            <span>Primary Workspace</span>
            <h2>Calendar</h2>
          </div>
          <button type="button" onClick={() => setIsDayDetailOpen(true)}>
            打开 {selectedDate}
          </button>
        </div>
        <CalendarView
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          eventsVersion={eventsVersion}
        />
      </div>
    )
  }

  return (
    <>
      <AmbientBackground />
      <main className="app">
        <CountdownBubbleLayer refreshVersion={countdownVersion} />

        <AppShell
          sidebar={
            <Sidebar
              activeWorkspace={activeWorkspace}
              categoriesVersion={categoriesVersion}
              onNavigate={setActiveWorkspace}
            />
          }
          topbar={<Topbar activeWorkspace={activeWorkspace} selectedDate={selectedDate} />}
          contextPanel={
            <ContextPanel>
              <VoiceControl
                onCalendarChange={handleEventsChange}
                onCategoryChange={handleCategoriesChange}
              />
              <CountdownPanel onCountdownChange={handleCountdownChange} />
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
            </ContextPanel>
          }
        >
          {renderWorkspace()}
        </AppShell>

        <DayDetailModal
          selectedDate={selectedDate}
          isOpen={isDayDetailOpen}
          onClose={() => setIsDayDetailOpen(false)}
          onEventsChange={handleEventsChange}
          categoriesVersion={categoriesVersion}
        />
      </main>
    </>
  )
}

export default App
