import { useEffect, useState } from 'react'
import AmbientBackground from './components/AmbientBackground.tsx'
import CalendarView from './components/CalendarView.tsx'
import CategoryPanel from './components/CategoryPanel.tsx'
import CommandPalette from './components/command/CommandPalette.tsx'
import CountdownPanel from './components/CountdownPanel.tsx'
import DayDetailModal from './components/DayDetailModal.tsx'
import FocusMode from './components/focus/FocusMode.tsx'
import VoiceControl, {
  type VoiceExternalCommand,
  type VoiceRuntimeStatus,
} from './components/VoiceControl.tsx'
import AppShell from './components/layout/AppShell.tsx'
import ContextPanel from './components/layout/ContextPanel.tsx'
import Sidebar, { type WorkspaceId } from './components/layout/Sidebar.tsx'
import Topbar from './components/layout/Topbar.tsx'
import TasksContextPanel from './components/tasks/TasksContextPanel.tsx'
import TasksWorkspace from './components/tasks/TasksWorkspace.tsx'
import { filterTasksByCategory } from './components/tasks/taskUtils.ts'
import NextEvent from './components/today/NextEvent.tsx'
import TodayOverview from './components/today/TodayOverview.tsx'
import TodayWorkspace from './components/today/TodayWorkspace.tsx'
import VoiceOrb from './components/voice/VoiceOrb.tsx'
import { formatDate } from './utils/date.ts'
import { getCategories } from './utils/storage.ts'
import { getTasks } from './utils/taskStorage.ts'
import './App.css'

const WORKSPACE_PLACEHOLDERS: Record<
  Exclude<WorkspaceId, 'today' | 'calendar' | 'tasks'>,
  {
    title: string
    description: string
  }
> = {
  insights: {
    title: 'Insights Workspace',
    description: 'Insights 将在后续 PR 中承载时间分析和总结。',
  },
  settings: {
    title: 'Settings Workspace',
    description: 'Settings 将在后续 PR 中承载偏好设置。',
  },
}

const DEFAULT_VOICE_STATUS: VoiceRuntimeStatus = {
  phase: 'idle',
  transcript: '',
  isListening: false,
  isSupported: true,
  wakeWordEnabled: false,
  error: null,
}

function App() {
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()))
  const [eventsVersion, setEventsVersion] = useState(0)
  const [categoriesVersion, setCategoriesVersion] = useState(0)
  const [countdownVersion, setCountdownVersion] = useState(0)
  const [taskVersion, setTaskVersion] = useState(0)
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false)
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('today')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [voiceListenSignal, setVoiceListenSignal] = useState(0)
  const [voiceTextCommand, setVoiceTextCommand] = useState<VoiceExternalCommand | null>(null)
  const [voiceStatus, setVoiceStatus] = useState<VoiceRuntimeStatus>(DEFAULT_VOICE_STATUS)
  const [createTaskSignal, setCreateTaskSignal] = useState(0)

  const selectedCategory =
    getCategories().find((category) => category.id === selectedCategoryId) ?? null

  const handleSelectDate = (date: Date) => {
    setSelectedDate(formatDate(date))
    setIsDayDetailOpen(true)
  }

  const handleEventsChange = () => {
    setEventsVersion((version) => version + 1)
  }

  const handleCategoriesChange = () => {
    setCategoriesVersion((version) => version + 1)
    if (selectedCategoryId && !getCategories().some((item) => item.id === selectedCategoryId)) {
      setSelectedCategoryId(null)
    }
  }

  const handleCountdownChange = () => {
    setCountdownVersion((version) => version + 1)
  }

  const handleTasksChange = () => {
    setTaskVersion((version) => version + 1)
  }

  const handleToggleVoiceInput = () => {
    setVoiceListenSignal((signal) => signal + 1)
  }

  const handleRunTextCommand = (text: string) => {
    const commandText = text.trim()
    if (!commandText) {
      return
    }

    setVoiceTextCommand((command) => ({
      id: (command?.id ?? 0) + 1,
      text: commandText,
    }))
  }

  const handleOpenNewEvent = () => {
    setActiveWorkspace('calendar')
    setIsDayDetailOpen(true)
  }

  const handleOpenNewTask = () => {
    setActiveWorkspace('tasks')
    setCreateTaskSignal((signal) => signal + 1)
  }

  const handleOpenEventDate = (date: string) => {
    setSelectedDate(date)
    setActiveWorkspace('calendar')
    setIsDayDetailOpen(true)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        setIsCommandPaletteOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const renderWorkspace = () => {
    if (activeWorkspace === 'today') {
      return (
        <TodayWorkspace
          selectedCategoryId={selectedCategoryId}
          selectedCategoryName={selectedCategory?.name ?? null}
          taskRefreshVersion={taskVersion}
          onTasksChange={handleTasksChange}
          onOpenCalendar={() => setActiveWorkspace('calendar')}
        />
      )
    }

    if (activeWorkspace === 'tasks') {
      return (
        <TasksWorkspace
          selectedCategoryId={selectedCategoryId}
          selectedCategoryName={selectedCategory?.name ?? null}
          createTaskSignal={createTaskSignal}
          onTasksChange={handleTasksChange}
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

  const contextTitle =
    activeWorkspace === 'tasks'
      ? 'Task Planning'
      : activeWorkspace === 'today'
        ? 'Today & Voice'
        : 'Calendar & Voice'

  const scopedTasks = filterTasksByCategory(getTasks(), selectedCategoryId)

  return (
    <>
      <AmbientBackground />
      <main className="app">
        <AppShell
          sidebar={
            <Sidebar
              activeWorkspace={activeWorkspace}
              selectedCategoryId={selectedCategoryId}
              onNavigate={setActiveWorkspace}
              onSelectCategory={setSelectedCategoryId}
            />
          }
          topbar={
            <Topbar
              activeWorkspace={activeWorkspace}
              selectedDate={selectedDate}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            />
          }
          contextPanel={
            <ContextPanel
              eyebrow={activeWorkspace === 'tasks' ? 'Tasks Context' : 'Context'}
              title={contextTitle}
            >
              {activeWorkspace === 'tasks' && (
                <TasksContextPanel
                  tasks={scopedTasks}
                  selectedCategoryName={selectedCategory?.name ?? null}
                />
              )}

              {activeWorkspace === 'today' && (
                <div className="today-context-stack">
                  <NextEvent />
                  <TodayOverview />
                </div>
              )}
              <VoiceControl
                onCalendarChange={handleEventsChange}
                onCategoryChange={handleCategoriesChange}
                listenSignal={voiceListenSignal}
                textCommand={voiceTextCommand}
                onRuntimeChange={setVoiceStatus}
              />
              <CountdownPanel
                onCountdownChange={handleCountdownChange}
                onEnterFocusMode={() => setIsFocusMode(true)}
              />
              <CategoryPanel
                eventsVersion={eventsVersion}
                onCategoriesChange={handleCategoriesChange}
              />
              {activeWorkspace !== 'tasks' && (
                <section className="day-detail-hint panel-card">
                  <h2 className="section-title">日期详情</h2>
                  <p>点击日历中的日期，查看和编辑当天事项。</p>
                  <button type="button" onClick={() => setIsDayDetailOpen(true)}>
                    打开 {selectedDate}
                  </button>
                </section>
              )}
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

        <VoiceOrb
          status={voiceStatus}
          onToggleListening={handleToggleVoiceInput}
          isHidden={isDayDetailOpen || isCommandPaletteOpen || isFocusMode}
        />

        {isFocusMode && (
          <FocusMode
            countdownRefreshVersion={countdownVersion}
            onExit={() => setIsFocusMode(false)}
          />
        )}

        {isCommandPaletteOpen && (
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            activeWorkspace={activeWorkspace}
            voiceStatus={voiceStatus}
            onClose={() => setIsCommandPaletteOpen(false)}
            onNavigate={setActiveWorkspace}
            onOpenNewEvent={handleOpenNewEvent}
            onOpenNewTask={handleOpenNewTask}
            onStartVoice={handleToggleVoiceInput}
            onRunTextCommand={handleRunTextCommand}
            onSelectCategory={setSelectedCategoryId}
            onOpenEventDate={handleOpenEventDate}
            onOpenTask={() => setActiveWorkspace('tasks')}
          />
        )}
      </main>
    </>
  )
}

export default App
