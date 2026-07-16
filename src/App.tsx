import { useEffect, useState } from 'react'
import {
  createTask as createBackendTask,
  deleteTask as deleteBackendTask,
  updateTask as updateBackendTask,
} from './api/taskApi.ts'
import {
  createCategory as createBackendCategory,
  deleteCategory as deleteBackendCategory,
} from './api/categoryApi.ts'
import { getTasks as getBackendTasks } from './api/taskApi.ts'
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
import { migrateLegacyTasks, TaskMigrationError } from './migrations/taskMigration.ts'
import {
  CategoryMigrationError,
  migrateLegacyCategories,
} from './migrations/categoryMigration.ts'
import {
  getEventErrorMessage,
  clearEventCategory,
  isBackendEventDataSource,
  loadEvents,
} from './services/eventDataSource.ts'
import { deleteCategoryDateLinks } from './utils/storage.ts'
import type { EventCategory, EventCategoryInput } from './types/calendar.ts'
import type { Task, TaskInput } from './types/task.ts'
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

type EventLoadStatus = 'ready' | 'loading' | 'error'
type TaskLoadStatus = 'ready' | 'loading' | 'error'
type CategoryLoadStatus = 'ready' | 'loading' | 'error'

const EVENT_LOADING_MESSAGE = '正在检查并迁移旧日程...'

function App() {
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()))
  const [, setEventsVersion] = useState(0)
  const [, setCategoryLinksVersion] = useState(0)
  const [countdownVersion, setCountdownVersion] = useState(0)
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskLoadStatus, setTaskLoadStatus] = useState<TaskLoadStatus>('loading')
  const [taskLoadError, setTaskLoadError] = useState('')
  const [categories, setCategories] = useState<EventCategory[]>([])
  const [categoryLoadStatus, setCategoryLoadStatus] =
    useState<CategoryLoadStatus>('loading')
  const [categoryLoadError, setCategoryLoadError] = useState('')
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false)
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('today')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [voiceListenSignal, setVoiceListenSignal] = useState(0)
  const [voiceTextCommand, setVoiceTextCommand] = useState<VoiceExternalCommand | null>(null)
  const [voiceStatus, setVoiceStatus] = useState<VoiceRuntimeStatus>(DEFAULT_VOICE_STATUS)
  const [createTaskSignal, setCreateTaskSignal] = useState(0)
  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState(false)
  const [eventLoadStatus, setEventLoadStatus] = useState<EventLoadStatus>(() =>
    isBackendEventDataSource() ? 'loading' : 'ready',
  )
  const [eventLoadError, setEventLoadError] = useState('')

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null

  const handleSelectDate = (date: Date) => {
    setSelectedDate(formatDate(date))
    setIsDayDetailOpen(true)
  }

  const handleEventsChange = () => {
    setEventsVersion((version) => version + 1)
  }

  const retryBackendEvents = async () => {
    setEventLoadStatus('loading')
    setEventLoadError('')
    try {
      await loadEvents()
      setEventLoadStatus('ready')
      setEventsVersion((version) => version + 1)
    } catch (error) {
      setEventLoadStatus('error')
      setEventLoadError(getEventErrorMessage(error, '暂时无法连接日程服务。'))
    }
  }

  const handleCategoryDateLinksChange = () => {
    setCategoryLinksVersion((version) => version + 1)
  }

  const retryBackendCategories = async () => {
    setCategoryLoadStatus('loading')
    setCategoryLoadError('')
    try {
      const result = await migrateLegacyCategories()
      setCategories(result.categories)
      setCategoryLoadStatus('ready')
    } catch (error) {
      if (error instanceof CategoryMigrationError) {
        setCategories(error.result.categories)
        setCategoryLoadError(error.message)
      } else {
        setCategoryLoadError('暂时无法连接分类服务。')
      }
      setCategoryLoadStatus('error')
    }
  }

  const handleCreateCategory = async (input: EventCategoryInput) => {
    const created = await createBackendCategory(input)
    setCategories((current) => [...current, created])
  }

  const handleDeleteCategory = async (id: string) => {
    await deleteBackendCategory(id)

    setCategories((current) => current.filter((category) => category.id !== id))
    setSelectedCategoryId((current) => (current === id ? null : current))
    setTasks((current) => current.map((task) =>
      task.categoryId === id ? { ...task, categoryId: undefined } : task,
    ))
    clearEventCategory(id)
    deleteCategoryDateLinks(id)
    setEventsVersion((version) => version + 1)
    setCategoryLinksVersion((version) => version + 1)

    try {
      const [refreshedTasks] = await Promise.all([
        getBackendTasks(),
        loadEvents(),
      ])
      setTasks(refreshedTasks)
      setEventsVersion((version) => version + 1)
    } catch {
      // Local React state already mirrors the committed delete transaction.
    }
  }

  const handleCountdownChange = () => {
    setCountdownVersion((version) => version + 1)
  }

  const retryBackendTasks = async () => {
    setTaskLoadStatus('loading')
    setTaskLoadError('')
    try {
      const result = await migrateLegacyTasks()
      setTasks(result.tasks)
      setTaskLoadStatus('ready')
    } catch (error) {
      if (error instanceof TaskMigrationError) {
        setTasks(error.result.tasks)
        setTaskLoadError(error.message)
      } else {
        setTaskLoadError('暂时无法连接任务服务。')
      }
      setTaskLoadStatus('error')
    }
  }

  const handleCreateTask = async (input: TaskInput) => {
    const created = await createBackendTask(input)
    setTasks((current) => [...current, created])
  }

  const handleUpdateTask = async (id: string, input: TaskInput) => {
    const updated = await updateBackendTask(id, input)
    setTasks((current) => current.map((task) => (task.id === id ? updated : task)))
  }

  const handleDeleteTask = async (id: string) => {
    await deleteBackendTask(id)
    setTasks((current) => current.filter((task) => task.id !== id))
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

  const handleOpenAutoSchedule = () => {
    setActiveWorkspace('tasks')
    setIsAutoScheduleOpen(true)
  }

  const handleOpenEventDate = (date: string) => {
    setSelectedDate(date)
    setActiveWorkspace('calendar')
    setIsDayDetailOpen(true)
  }

  useEffect(() => {
    if (!isBackendEventDataSource()) {
      return
    }

    let cancelled = false
    void loadEvents()
      .then(() => {
        if (!cancelled) {
          setEventLoadStatus('ready')
          setEventsVersion((version) => version + 1)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setEventLoadStatus('error')
          setEventLoadError(getEventErrorMessage(error, '暂时无法连接日程服务。'))
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void migrateLegacyCategories()
      .then((result) => {
        if (!cancelled) {
          setCategories(result.categories)
          setCategoryLoadStatus('ready')
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          if (error instanceof CategoryMigrationError) {
            setCategories(error.result.categories)
            setCategoryLoadError(error.message)
          } else {
            setCategoryLoadError('暂时无法连接分类服务。')
          }
          setCategoryLoadStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void migrateLegacyTasks()
      .then((result) => {
        if (!cancelled) {
          setTasks(result.tasks)
          setTaskLoadStatus('ready')
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          if (error instanceof TaskMigrationError) {
            setTasks(error.result.tasks)
            setTaskLoadError(error.message)
          } else {
            setTaskLoadError('暂时无法连接任务服务。')
          }
          setTaskLoadStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

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
          tasks={tasks}
          selectedCategoryId={selectedCategoryId}
          selectedCategoryName={selectedCategory?.name ?? null}
          onUpdateTask={handleUpdateTask}
          onOpenCalendar={() => setActiveWorkspace('calendar')}
        />
      )
    }

    if (activeWorkspace === 'tasks') {
      return (
        <TasksWorkspace
          tasks={tasks}
          categories={categories}
          loadStatus={taskLoadStatus}
          loadError={taskLoadError}
          selectedCategoryId={selectedCategoryId}
          selectedCategoryName={selectedCategory?.name ?? null}
          createTaskSignal={createTaskSignal}
          isSchedulingOpen={isAutoScheduleOpen}
          onRetryLoad={() => void retryBackendTasks()}
          onCreateTask={handleCreateTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onEventsChange={handleEventsChange}
          onOpenAutoSchedule={handleOpenAutoSchedule}
          onCloseAutoSchedule={() => setIsAutoScheduleOpen(false)}
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
        <CalendarView selectedDate={selectedDate} onSelectDate={handleSelectDate} />
      </div>
    )
  }

  const contextTitle =
    activeWorkspace === 'tasks'
      ? 'Task Planning'
      : activeWorkspace === 'today'
        ? 'Today & Voice'
        : 'Calendar & Voice'

  const scopedTasks = filterTasksByCategory(tasks, selectedCategoryId)

  return (
    <>
      <AmbientBackground />
      <main className="app">
        {eventLoadStatus !== 'ready' && (
          <div
            className={`event-source-status event-source-status--${eventLoadStatus}`}
            role={eventLoadStatus === 'error' ? 'alert' : 'status'}
          >
            <span>
              {eventLoadStatus === 'loading' ? EVENT_LOADING_MESSAGE : eventLoadError}
            </span>
            {eventLoadStatus === 'error' && (
              <button
                type="button"
                onClick={() => void retryBackendEvents()}
              >
                重试
              </button>
            )}
          </div>
        )}
        <AppShell
          sidebar={
            <Sidebar
              activeWorkspace={activeWorkspace}
              categories={categories}
              categoryLoadStatus={categoryLoadStatus}
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
                  onAutoSchedule={handleOpenAutoSchedule}
                />
              )}

              {activeWorkspace === 'today' && (
                <div className="today-context-stack">
                  <NextEvent />
                  <TodayOverview />
                </div>
              )}
              <VoiceControl
                categories={categories}
                onCalendarChange={handleEventsChange}
                onCategoryChange={handleCategoryDateLinksChange}
                listenSignal={voiceListenSignal}
                textCommand={voiceTextCommand}
                onRuntimeChange={setVoiceStatus}
              />
              <CountdownPanel
                onCountdownChange={handleCountdownChange}
                onEnterFocusMode={() => setIsFocusMode(true)}
              />
              <CategoryPanel
                categories={categories}
                tasks={tasks}
                loadStatus={categoryLoadStatus}
                loadError={categoryLoadError}
                onRetryLoad={() => void retryBackendCategories()}
                onCreateCategory={handleCreateCategory}
                onDeleteCategory={handleDeleteCategory}
                onDateLinksChange={handleCategoryDateLinksChange}
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
          categories={categories}
          isOpen={isDayDetailOpen}
          onClose={() => setIsDayDetailOpen(false)}
          onEventsChange={handleEventsChange}
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
            tasks={tasks}
            categories={categories}
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
