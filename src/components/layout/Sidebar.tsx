import { buildCategoryEventCounts } from '../category/categoryFilters.ts'
import { getCategories } from '../../utils/storage.ts'

export type WorkspaceId = 'today' | 'calendar' | 'tasks' | 'insights' | 'settings'

type SidebarProps = {
  activeWorkspace: WorkspaceId
  selectedCategoryId: string | null
  onNavigate: (workspace: WorkspaceId) => void
  onSelectCategory: (categoryId: string | null) => void
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
  selectedCategoryId,
  onNavigate,
  onSelectCategory,
}: SidebarProps) {
  const categories = getCategories()
  const categoryCounts = buildCategoryEventCounts(categories)
  const totalCategoryCount = Object.values(categoryCounts).reduce(
    (total, count) => total + count,
    0,
  )

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
            onClick={() => onSelectCategory(null)}
          >
            <span className="category-mark" aria-hidden />
            <span className="app-sidebar-category-name">全部分类</span>
            <small>{totalCategoryCount}</small>
          </button>

          {categories.length === 0 ? (
            <p className="app-sidebar-empty">No categories yet</p>
          ) : (
            categories.slice(0, 10).map((category) => (
              <button
                key={category.id}
                type="button"
                className={`app-sidebar-category${
                  selectedCategoryId === category.id ? ' app-sidebar-category--active' : ''
                }`}
                aria-pressed={selectedCategoryId === category.id}
                onClick={() => onSelectCategory(category.id)}
              >
                <span className="category-mark" aria-hidden />
                <span className="app-sidebar-category-name">{category.name}</span>
                <small>{categoryCounts[category.id] ?? 0}</small>
              </button>
            ))
          )}
        </nav>
      </section>
    </aside>
  )
}
