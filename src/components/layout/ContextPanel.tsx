import type { ReactNode } from 'react'

type ContextPanelProps = {
  children: ReactNode
  eyebrow?: string
  title?: string
}

export default function ContextPanel({
  children,
  eyebrow = 'Context',
  title = 'Today & Voice',
}: ContextPanelProps) {
  return (
    <aside className="context-panel" aria-label="Context panel">
      <div className="context-panel-header">
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      <div className="context-panel-stack">{children}</div>
    </aside>
  )
}
