import { useEffect, useMemo, useRef, useState } from 'react'
import type { EventCategory } from '../../types/calendar.ts'
import type { Task, TaskInput } from '../../types/task.ts'
import { getCategories } from '../../utils/storage.ts'
import { addTask, deleteTask, getTasks, updateTask } from '../../utils/taskStorage.ts'
import TaskEditorModal from './TaskEditorModal.tsx'
import TaskList from './TaskList.tsx'
import {
  filterTasksByCategory,
  filterTasksByTab,
  sortTasks,
  type TaskTab,
} from './taskUtils.ts'

type TasksWorkspaceProps = {
  selectedCategoryId?: string | null
  selectedCategoryName?: string | null
  createTaskSignal?: number
  onTasksChange?: () => void
}

const TASK_TABS: Array<{ id: TaskTab; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
]

export default function TasksWorkspace({
  selectedCategoryId = null,
  selectedCategoryName = null,
  createTaskSignal = 0,
  onTasksChange,
}: TasksWorkspaceProps) {
  const [tasks, setTasks] = useState(() => getTasks())
  const [activeTab, setActiveTab] = useState<TaskTab>('today')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const lastCreateTaskSignalRef = useRef(createTaskSignal)

  const categories: EventCategory[] = getCategories()

  const visibleTasks = useMemo(() => {
    const categoryTasks = filterTasksByCategory(tasks, selectedCategoryId)
    return sortTasks(filterTasksByTab(categoryTasks, activeTab))
  }, [activeTab, selectedCategoryId, tasks])

  const refreshTasks = () => {
    setTasks(getTasks())
    onTasksChange?.()
  }

  const openCreateTask = () => {
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
    setEditingTask(task)
    setIsEditorOpen(true)
  }

  const handleSaveTask = (taskInput: TaskInput, taskId?: string) => {
    if (taskId) {
      updateTask(taskId, taskInput)
    } else {
      addTask(taskInput)
    }
    setIsEditorOpen(false)
    setEditingTask(null)
    refreshTasks()
  }

  const handleToggleTask = (task: Task) => {
    updateTask(task.id, {
      status: task.status === 'completed' ? 'pending' : 'completed',
    })
    refreshTasks()
  }

  const handleDeleteTask = (taskId: string) => {
    deleteTask(taskId)
    refreshTasks()
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
          <button type="button" className="task-auto-btn" disabled>
            自动安排
          </button>
        </div>
      </header>

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
        onToggleTask={handleToggleTask}
        onEditTask={openEditTask}
        onDeleteTask={handleDeleteTask}
      />

      {isEditorOpen && (
        <TaskEditorModal
          task={editingTask}
          categories={categories}
          defaultCategoryId={selectedCategoryId}
          onSave={handleSaveTask}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  )
}
