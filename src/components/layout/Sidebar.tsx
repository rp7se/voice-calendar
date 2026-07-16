import type { EventCategory } from '../../types/calendar.ts'

export type WorkspaceId = 'today' | 'calendar' | 'tasks' | 'insights' | 'settings'

type SidebarProps = {
  activeWorkspace: WorkspaceId
  categories: EventCategory[]
  categoryLoadStatus?: 'loading' | 'ready' | 'error'
  selectedCategoryId?: string | null
  onNavigate: (workspace: WorkspaceId) => void
  onSelectCategory?: (categoryId: string | null) => void
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
  categories,
  categoryLoadStatus = 'ready',
  selectedCategoryId = null,
  onNavigate,
  onSelectCategory,
}: SidebarProps) {
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
        <nav className="app-sidebar-category-list" aria-label="Category filters">
          <button
            type="button"
            className={`app-sidebar-category${
              selectedCategoryId === null ? ' app-sidebar-category--active' : ''
            }`}
            aria-pressed={selectedCategoryId === null}
            onClick={() => onSelectCategory?.(null)}
          >
            <span className="category-mark" aria-hidden />
            <span className="app-sidebar-category-name">全部分类</span>
          </button>

          {categoryLoadStatus === 'error' ? (
            <p className="app-sidebar-empty">分类服务暂不可用</p>
          ) : categoryLoadStatus === 'loading' ? (
            <p className="app-sidebar-empty">正在加载分类...</p>
          ) : categories.length === 0 ? (
            <p className="app-sidebar-empty">No categories yet</p>
          ) : (
            categories.slice(0, 8).map((category) => (
              <button
                key={category.id}
                type="button"
                className={`app-sidebar-category${
                  selectedCategoryId === category.id ? ' app-sidebar-category--active' : ''
                }`}
                aria-pressed={selectedCategoryId === category.id}
                onClick={() => onSelectCategory?.(category.id)}
              >
                <span className="category-mark" aria-hidden />
                <span className="app-sidebar-category-name">{category.name}</span>
              </button>
            ))
          )}
        </nav>
      </section>
    </aside>
  )
}
