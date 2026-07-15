import type { ReactNode } from 'react'

type ContextPanelProps = {
  children: ReactNode
}

export default function ContextPanel({ children }: ContextPanelProps) {
  return (
    <aside className="context-panel" aria-label="Context panel">
      <div className="context-panel-header">
        <span>Context</span>
        <strong>Today & Voice</strong>
      </div>
      <div className="context-panel-stack">{children}</div>
    </aside>
  )
}
