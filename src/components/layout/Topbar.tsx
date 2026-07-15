import type { WorkspaceId } from './Sidebar.tsx'

type TopbarProps = {
  activeWorkspace: WorkspaceId
  selectedDate: string
  onOpenCommandPalette: () => void
}

const WORKSPACE_TITLES: Record<WorkspaceId, string> = {
  today: 'Today',
  calendar: 'Calendar',
  tasks: 'Tasks',
  insights: 'Insights',
  settings: 'Settings',
}

export default function Topbar({
  activeWorkspace,
  selectedDate,
  onOpenCommandPalette,
}: TopbarProps) {
  const shortcutLabel =
    typeof navigator !== 'undefined' && navigator.platform.toLocaleLowerCase().includes('mac')
      ? '⌘ K'
      : 'Ctrl K'

  return (
    <header className="app-topbar">
      <div className="app-topbar-title">
        <span>Workspace</span>
        <h1>{WORKSPACE_TITLES[activeWorkspace]}</h1>
      </div>

      <button
        type="button"
        className="command-entry"
        onClick={onOpenCommandPalette}
        aria-label="打开快捷指令面板"
      >
        <span>搜索日程或告诉小历你想做什么...</span>
        <kbd>{shortcutLabel}</kbd>
      </button>

      <div className="app-topbar-meta" aria-label="Current date">
        <span>Selected</span>
        <strong>{selectedDate}</strong>
      </div>
    </header>
  )
}
