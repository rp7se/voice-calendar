import { useState } from 'react'
import AmbientBackground from './components/AmbientBackground.tsx'
import CalendarView from './components/CalendarView.tsx'
import CalendarDayContext from './components/calendar/CalendarDayContext.tsx'
import { getCategoryById } from './components/category/categoryFilters.ts'
import CategoryPanel from './components/CategoryPanel.tsx'
import CountdownBubbleLayer from './components/CountdownBubbleLayer.tsx'
import CountdownPanel from './components/CountdownPanel.tsx'
import DayDetailModal from './components/DayDetailModal.tsx'
import VoiceControl from './components/VoiceControl.tsx'
import AppShell from './components/layout/AppShell.tsx'
import ContextPanel from './components/layout/ContextPanel.tsx'
import Sidebar, { type WorkspaceId } from './components/layout/Sidebar.tsx'
import Topbar from './components/layout/Topbar.tsx'
import NextEvent from './components/today/NextEvent.tsx'
import TodayOverview from './components/today/TodayOverview.tsx'
import TodayWorkspace from './components/today/TodayWorkspace.tsx'
import { formatDate } from './utils/date.ts'
import './App.css'

const WORKSPACE_PLACEHOLDERS: Record<
  Exclude<WorkspaceId, 'today' | 'calendar'>,
  {
    title: string
    description: string
  }
> = {
  tasks: {
    title: 'Tasks Workspace',
    description: 'Tasks 将在后续 PR 中实现完整任务视图；当前先保留导航入口。',
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
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('today')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const selectedCategory = getCategoryById(selectedCategoryId)

  const handleSelectDate = (date: Date) => {
    setSelectedDate(formatDate(date))
  }

  const openDayDetailModal = () => {
    setIsDayDetailOpen(true)
  }

  const handleEventsChange = () => {
    setEventsVersion((version) => version + 1)
  }

  const handleCategoriesChange = () => {
    setCategoriesVersion((version) => version + 1)
    if (selectedCategoryId && !getCategoryById(selectedCategoryId)) {
      setSelectedCategoryId(null)
    }
  }

  const handleCountdownChange = () => {
    setCountdownVersion((version) => version + 1)
  }

  const renderWorkspace = () => {
    if (activeWorkspace === 'today') {
      return (
        <TodayWorkspace
          selectedCategoryId={selectedCategoryId}
          selectedCategoryName={selectedCategory?.name ?? null}
          onOpenCalendar={() => setActiveWorkspace('calendar')}
        />
      )
    }

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
        <CalendarView
          selectedDate={selectedDate}
          selectedCategoryId={selectedCategoryId}
          selectedCategoryName={selectedCategory?.name ?? null}
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
              selectedCategoryId={selectedCategoryId}
              onNavigate={setActiveWorkspace}
              onSelectCategory={setSelectedCategoryId}
            />
          }
          topbar={<Topbar activeWorkspace={activeWorkspace} selectedDate={selectedDate} />}
          contextPanel={
            <ContextPanel
              eyebrow={activeWorkspace === 'calendar' ? 'Calendar Context' : 'Context'}
              title={activeWorkspace === 'calendar' ? selectedDate : 'Today & Voice'}
            >
              {selectedCategory && (
                <section className="category-focus-card" aria-label="Current category filter">
                  <span>当前分类</span>
                  <strong>{selectedCategory.name}</strong>
                  <button type="button" onClick={() => setSelectedCategoryId(null)}>
                    查看全部
                  </button>
                </section>
              )}

              {activeWorkspace === 'calendar' && (
                <CalendarDayContext
                  selectedDate={selectedDate}
                  selectedCategoryId={selectedCategoryId}
                  selectedCategoryName={selectedCategory?.name ?? null}
                  eventsVersion={eventsVersion}
                  categoriesVersion={categoriesVersion}
                  onOpenDayDetail={openDayDetailModal}
                />
              )}

              {activeWorkspace === 'today' && (
                <div className="today-context-stack">
                  <NextEvent selectedCategoryId={selectedCategoryId} />
                  <TodayOverview selectedCategoryId={selectedCategoryId} />
                </div>
              )}

              <VoiceControl
                onCalendarChange={handleEventsChange}
                onCategoryChange={handleCategoriesChange}
              />
              <CountdownPanel onCountdownChange={handleCountdownChange} />
              <CategoryPanel
                eventsVersion={eventsVersion}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
                onCategoriesChange={handleCategoriesChange}
              />
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
