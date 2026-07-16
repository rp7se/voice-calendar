import { useEffect, useMemo, useRef, useState } from 'react'
import type { EventCategory } from '../../types/calendar.ts'
import type { Task, TaskInput } from '../../types/task.ts'
import SchedulingPreviewModal from './SchedulingPreviewModal.tsx'
import TaskEditorModal from './TaskEditorModal.tsx'
import TaskList from './TaskList.tsx'
import {
  filterTasksByCategory,
  filterTasksByTab,
  sortTasks,
  type TaskTab,
} from './taskUtils.ts'

type TasksWorkspaceProps = {
  tasks: Task[]
  categories: EventCategory[]
  loadStatus: 'loading' | 'ready' | 'error'
  loadError?: string
  selectedCategoryId?: string | null
  selectedCategoryName?: string | null
  createTaskSignal?: number
  isSchedulingOpen?: boolean
  onRetryLoad: () => void
  onCreateTask: (input: TaskInput) => Promise<void>
  onUpdateTask: (id: string, input: TaskInput) => Promise<void>
  onDeleteTask: (id: string) => Promise<void>
  onEventsChange?: () => void
  onOpenAutoSchedule?: () => void
  onCloseAutoSchedule?: () => void
}

const TASK_TABS: Array<{ id: TaskTab; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
]

export default function TasksWorkspace({
  tasks,
  categories,
  loadStatus,
  loadError = '',
  selectedCategoryId = null,
  selectedCategoryName = null,
  createTaskSignal = 0,
  isSchedulingOpen = false,
  onRetryLoad,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onEventsChange,
  onOpenAutoSchedule,
  onCloseAutoSchedule,
}: TasksWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TaskTab>('today')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [operationError, setOperationError] = useState('')
  const lastCreateTaskSignalRef = useRef(createTaskSignal)

  const visibleTasks = useMemo(() => {
    const categoryTasks = filterTasksByCategory(tasks, selectedCategoryId)
    return sortTasks(filterTasksByTab(categoryTasks, activeTab))
  }, [activeTab, selectedCategoryId, tasks])

  const schedulableTasks = useMemo(
    () =>
      filterTasksByCategory(tasks, selectedCategoryId).filter(
        (task) => task.status === 'pending',
      ),
    [selectedCategoryId, tasks],
  )

  const openCreateTask = () => {
    setOperationError('')
    setEditingTask(null)
    setIsEditorOpen(true)
  }

  useEffect(() => {
    if (createTaskSignal === lastCreateTaskSignalRef.current) {
      return
    }

    lastCreateTaskSignalRef.current = createTaskSignal
    setEditingTask(null)
    setIsEditorOpen(true)
  }, [createTaskSignal])

  const openEditTask = (task: Task) => {
    setOperationError('')
    setEditingTask(task)
    setIsEditorOpen(true)
  }

  const handleSaveTask = async (taskInput: TaskInput, taskId?: string) => {
    setIsSaving(true)
    setOperationError('')
    try {
      if (taskId) {
        await onUpdateTask(taskId, taskInput)
      } else {
        await onCreateTask(taskInput)
      }
      setIsEditorOpen(false)
      setEditingTask(null)
    } catch {
      setOperationError('任务保存失败，请确认任务服务是否正常运行。')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleTask = async (task: Task) => {
    setOperationError('')
    try {
      await onUpdateTask(task.id, {
        ...task,
        status: task.status === 'completed' ? 'pending' : 'completed',
      })
    } catch {
      setOperationError('任务状态更新失败，原状态已保留。')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    setOperationError('')
    try {
      await onDeleteTask(taskId)
    } catch {
      setOperationError('任务删除失败，原任务已保留。')
    }
  }

  return (
    <div className="tasks-workspace">
      <header className="tasks-header">
        <div>
          <span>Workspace</span>
          <h2>Tasks</h2>
          <p>管理待办、截止时间与预计耗时</p>
          {selectedCategoryName && (
            <span className="workspace-filter-note">当前视图：{selectedCategoryName}</span>
          )}
        </div>
        <div className="tasks-header-actions">
          <button type="button" className="task-create-btn" onClick={openCreateTask}>
            + 新建任务
          </button>
          <button
            type="button"
            className="task-auto-btn"
            onClick={onOpenAutoSchedule}
            disabled={schedulableTasks.length === 0}
            aria-describedby={schedulableTasks.length === 0 ? 'task-auto-hint' : undefined}
          >
            自动安排
          </button>
        </div>
      </header>

      {loadStatus === 'loading' && (
        <p className="task-service-status" role="status">正在加载任务...</p>
      )}
      {loadStatus === 'error' && (
        <div className="task-service-status task-service-status--error" role="alert">
          <span>{loadError || '暂时无法连接任务服务。'}</span>
          <button type="button" onClick={onRetryLoad}>重试</button>
        </div>
      )}
      {operationError && !isEditorOpen && (
        <p className="task-operation-error" role="alert">{operationError}</p>
      )}

      {schedulableTasks.length === 0 && (
        <p id="task-auto-hint" className="task-auto-hint" role="status">
          暂无需要安排的任务。
        </p>
      )}

      <nav className="task-filter-tabs" aria-label="Task filters">
        {TASK_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'task-filter-tab is-active' : 'task-filter-tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <TaskList
        tasks={visibleTasks}
        categories={categories}
        onToggleTask={(task) => void handleToggleTask(task)}
        onEditTask={openEditTask}
        onDeleteTask={(taskId) => void handleDeleteTask(taskId)}
      />

      {isEditorOpen && (
        <TaskEditorModal
          task={editingTask}
          categories={categories}
          defaultCategoryId={selectedCategoryId}
          isSaving={isSaving}
          errorMessage={operationError}
          onSave={handleSaveTask}
          onClose={() => {
            if (!isSaving) {
              setIsEditorOpen(false)
              setOperationError('')
            }
          }}
        />
      )}

      {isSchedulingOpen && schedulableTasks.length > 0 && (
        <SchedulingPreviewModal
          tasks={schedulableTasks}
          categories={categories}
          selectedCategoryName={selectedCategoryName}
          onEventsChange={onEventsChange}
          onClose={() => onCloseAutoSchedule?.()}
        />
      )}
    </div>
  )
}
