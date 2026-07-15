import type { WorkspaceId } from './Sidebar.tsx'

type TopbarProps = {
  activeWorkspace: WorkspaceId
  selectedDate: string
}

const WORKSPACE_TITLES: Record<WorkspaceId, string> = {
  today: 'Today',
  calendar: 'Calendar',
  tasks: 'Tasks',
  insights: 'Insights',
  settings: 'Settings',
}

export default function Topbar({ activeWorkspace, selectedDate }: TopbarProps) {
  return (
    <header className="app-topbar">
      <div className="app-topbar-title">
        <span>Workspace</span>
        <h1>{WORKSPACE_TITLES[activeWorkspace]}</h1>
      </div>

      <label className="command-entry">
        <span className="sr-only">搜索日程或输入指令</span>
        <input type="search" placeholder="搜索日程或输入指令..." />
      </label>

      <div className="app-topbar-meta" aria-label="Current date">
        <span>Selected</span>
        <strong>{selectedDate}</strong>
      </div>
    </header>
  )
}
