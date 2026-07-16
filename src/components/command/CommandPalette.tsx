import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import type { WorkspaceId } from '../layout/Sidebar.tsx'
import type { VoiceRuntimeStatus } from '../VoiceControl.tsx'
import { getEvents } from '../../services/eventDataSource.ts'
import { getCategories } from '../../utils/storage.ts'
import type { Task } from '../../types/task.ts'

type CommandPaletteProps = {
  isOpen: boolean
  activeWorkspace: WorkspaceId
  voiceStatus: VoiceRuntimeStatus
  tasks: Task[]
  onClose: () => void
  onNavigate: (workspace: WorkspaceId) => void
  onOpenNewEvent: () => void
  onOpenNewTask: () => void
  onStartVoice: () => void
  onRunTextCommand: (text: string) => void
  onSelectCategory: (categoryId: string | null) => void
  onOpenEventDate: (date: string) => void
  onOpenTask: () => void
}

type PaletteItem = {
  id: string
  group: string
  title: string
  meta?: string
  keywords: string
  run: () => void
}

const WORKSPACE_ITEMS: Array<{
  id: WorkspaceId
  title: string
  meta: string
  keywords: string
}> = [
  { id: 'today', title: '查看 Today', meta: '打开今日工作区', keywords: 'today 今日 今天' },
  { id: 'calendar', title: '打开 Calendar', meta: '进入日历工作区', keywords: 'calendar 日历 月历' },
  { id: 'tasks', title: '打开 Tasks', meta: '进入任务工作区', keywords: 'tasks 任务 待办' },
  { id: 'insights', title: '打开 Insights', meta: '占位工作区', keywords: 'insights 洞察 分析' },
  { id: 'settings', title: '打开 Settings', meta: '占位工作区', keywords: 'settings 设置' },
]

const VOICE_COMMAND_EXAMPLES = [
  '明天下午三点添加项目会议',
  '查看今天的日程',
  '删除明天下午的会议',
]

function normalizeQuery(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function matchesQuery(item: PaletteItem, query: string): boolean {
  if (!query) {
    return true
  }

  const source = `${item.title} ${item.meta ?? ''} ${item.keywords}`.toLocaleLowerCase()
  return source.includes(query)
}

export default function CommandPalette({
  isOpen,
  activeWorkspace,
  voiceStatus,
  tasks,
  onClose,
  onNavigate,
  onOpenNewEvent,
  onOpenNewTask,
  onStartVoice,
  onRunTextCommand,
  onSelectCategory,
  onOpenEventDate,
  onOpenTask,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null
    const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus())

    return () => {
      window.cancelAnimationFrame(focusFrame)
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  const normalizedQuery = normalizeQuery(query)

  const items = useMemo<PaletteItem[]>(() => {
    const commands: PaletteItem[] = [
      ...WORKSPACE_ITEMS.map((item) => ({
        id: `workspace-${item.id}`,
        group: '快捷导航',
        title: item.title,
        meta: activeWorkspace === item.id ? '当前工作区' : item.meta,
        keywords: item.keywords,
        run: () => {
          onNavigate(item.id)
          onClose()
        },
      })),
      {
        id: 'action-new-event',
        group: '快速操作',
        title: '新建日程',
        meta: '打开现有日期详情创建入口',
        keywords: '新建 日程 添加 事件 event',
        run: () => {
          onOpenNewEvent()
          onClose()
        },
      },
      {
        id: 'action-new-task',
        group: '快速操作',
        title: '新建任务',
        meta: '打开现有任务创建入口',
        keywords: '新建 任务 添加 待办 task',
        run: () => {
          onOpenNewTask()
          onClose()
        },
      },
      {
        id: 'action-voice',
        group: '快速操作',
        title: voiceStatus.phase === 'listening' ? '停止语音输入' : '开始语音输入',
        meta: voiceStatus.wakeWordEnabled ? '唤醒词模式已开启' : '手动启动小历语音',
        keywords: '语音 voice microphone 小历',
        run: () => {
          onStartVoice()
          onClose()
        },
      },
    ]

    if (normalizedQuery) {
      commands.push({
        id: 'action-text-command',
        group: '文本指令',
        title: `作为文本指令执行：“${query.trim()}”`,
        meta: '复用现有语音指令解析逻辑',
        keywords: query,
        run: () => {
          onRunTextCommand(query)
          onClose()
        },
      })
    }

    const searchedEvents = normalizedQuery
      ? getEvents()
          .filter((event) =>
            `${event.title} ${event.description} ${event.date} ${event.startTime}`
              .toLocaleLowerCase()
              .includes(normalizedQuery),
          )
          .slice(0, 6)
          .map<PaletteItem>((event) => ({
            id: `event-${event.id}`,
            group: '日程',
            title: event.title,
            meta: `${event.date} · ${event.startTime}${event.endTime ? `-${event.endTime}` : ''}`,
            keywords: `${event.description} ${event.type}`,
            run: () => {
              onOpenEventDate(event.date)
              onClose()
            },
          }))
      : []

    const searchedTasks = normalizedQuery
      ? tasks
          .filter((task) =>
            `${task.title} ${task.priority} ${task.deadlineDate ?? ''}`
              .toLocaleLowerCase()
              .includes(normalizedQuery),
          )
          .slice(0, 6)
          .map<PaletteItem>((task) => ({
            id: `task-${task.id}`,
            group: '任务',
            title: task.title,
            meta: task.status === 'completed' ? '已完成' : '待处理',
            keywords: `${task.priority} ${task.deadlineDate ?? ''}`,
            run: () => {
              onOpenTask()
              onClose()
            },
          }))
      : []

    const searchedCategories = normalizedQuery
      ? getCategories()
          .filter((category) =>
            `${category.name} ${category.description ?? ''}`
              .toLocaleLowerCase()
              .includes(normalizedQuery),
          )
          .slice(0, 6)
          .map<PaletteItem>((category) => ({
            id: `category-${category.id}`,
            group: '分类',
            title: category.name,
            meta: '切换分类筛选',
            keywords: category.description ?? '',
            run: () => {
              onSelectCategory(category.id)
              onClose()
            },
          }))
      : []

    return [
      ...commands.filter((item) => matchesQuery(item, normalizedQuery)),
      ...searchedEvents,
      ...searchedTasks,
      ...searchedCategories,
    ]
  }, [
    activeWorkspace,
    normalizedQuery,
    onClose,
    onNavigate,
    onOpenEventDate,
    onOpenNewEvent,
    onOpenNewTask,
    onOpenTask,
    onRunTextCommand,
    onSelectCategory,
    onStartVoice,
    query,
    tasks,
    voiceStatus.phase,
    voiceStatus.wakeWordEnabled,
  ])

  const selectedItem = items[selectedIndex]

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((index) => (items.length === 0 ? 0 : (index + 1) % items.length))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((index) =>
        items.length === 0 ? 0 : (index - 1 + items.length) % items.length,
      )
      return
    }

    if (event.key === 'Enter' && selectedItem) {
      event.preventDefault()
      selectedItem.run()
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="command-palette-overlay" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="快捷指令面板"
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-palette-search">
          <span aria-hidden>⌘</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
            }}
            placeholder={
              voiceStatus.phase === 'listening'
                ? '正在聆听...'
                : '搜索日程、任务、分类，或输入指令...'
            }
            aria-label="搜索日程或输入指令"
          />
          <kbd>Esc</kbd>
        </div>

        {voiceStatus.transcript && (
          <p className="command-palette-transcript">识别文本：{voiceStatus.transcript}</p>
        )}

        {!normalizedQuery && (
          <div className="command-palette-examples" aria-label="语音指令示例">
            <span>可以试试</span>
            <div>
              {VOICE_COMMAND_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setQuery(example)
                    setSelectedIndex(0)
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="command-palette-list" role="listbox" aria-label="快捷指令结果">
          {items.length === 0 ? (
            <p className="command-palette-empty">没有找到匹配项。</p>
          ) : (
            items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selectedIndex === index}
                className={`command-palette-item${
                  selectedIndex === index ? ' command-palette-item--active' : ''
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={item.run}
              >
                <span className="command-palette-item-group">{item.group}</span>
                <span className="command-palette-item-main">
                  <strong>{item.title}</strong>
                  {item.meta && <small>{item.meta}</small>}
                </span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
