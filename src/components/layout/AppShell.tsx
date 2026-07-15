import type { ReactNode } from 'react'

type AppShellProps = {
  sidebar: ReactNode
  topbar: ReactNode
  children: ReactNode
  contextPanel: ReactNode
}

export default function AppShell({
  sidebar,
  topbar,
  children,
  contextPanel,
}: AppShellProps) {
  return (
    <div className="app-shell">
      {sidebar}
      <div className="app-shell-body">
        {topbar}
        <div className="app-shell-workspace">
          <main className="workspace-main" aria-label="VoiceCalendar workspace">
            {children}
          </main>
          {contextPanel}
        </div>
      </div>
    </div>
  )
}
