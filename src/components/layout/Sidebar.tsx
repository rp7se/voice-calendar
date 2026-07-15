import { getCategories } from '../../utils/storage.ts'

export type WorkspaceId = 'today' | 'calendar' | 'tasks' | 'insights' | 'settings'

type SidebarProps = {
  activeWorkspace: WorkspaceId
  categoriesVersion: number
  onNavigate: (workspace: WorkspaceId) => void
}

const NAV_ITEMS: Array<{ id: WorkspaceId; label: string; eyebrow: string }> = [
  { id: 'today', label: 'Today', eyebrow: 'Now' },
  { id: 'calendar', label: 'Calendar', eyebrow: 'Plan' },
  { id: 'tasks', label: 'Tasks', eyebrow: 'Next' },
  { id: 'insights', label: 'Insights', eyebrow: 'Review' },
  { id: 'settings', label: 'Settings', eyebrow: 'System' },
]

export default function Sidebar({
  activeWorkspace,
  onNavigate,
}: SidebarProps) {
  const categories = getCategories()

  return (
    <aside className="app-sidebar" aria-label="VoiceCalendar navigation">
      <div className="app-sidebar-brand">
        <span className="app-sidebar-logo" aria-hidden>
          VC
        </span>
        <div>
          <strong>VoiceCalendar</strong>
          <span>Time OS</span>
        </div>
      </div>

      <nav className="app-sidebar-nav" aria-label="Primary workspace">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`app-sidebar-link${
              activeWorkspace === item.id ? ' app-sidebar-link--active' : ''
            }`}
            aria-current={activeWorkspace === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <span>{item.label}</span>
            <small>{item.eyebrow}</small>
          </button>
        ))}
      </nav>

      <section className="app-sidebar-section" aria-label="Categories">
        <div className="app-sidebar-section-header">
          <span>Categories</span>
          <small>{categories.length}</small>
        </div>
        <div className="app-sidebar-category-list">
          {categories.length === 0 ? (
            <p className="app-sidebar-empty">No categories yet</p>
          ) : (
            categories.slice(0, 8).map((category) => (
              <span key={category.id} className="app-sidebar-category">
                <span aria-hidden />
                {category.name}
              </span>
            ))
          )}
        </div>
      </section>
    </aside>
  )
}
