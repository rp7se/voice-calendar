type CalendarHeaderProps = {
  monthLabel: string
  selectedCategoryName?: string | null
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
}

export default function CalendarHeader({
  monthLabel,
  selectedCategoryName = null,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarHeaderProps) {
  return (
    <header className="calendar-workspace-header">
      <div className="calendar-heading">
        <span>Workspace</span>
        <h2>Calendar</h2>
        <p>{monthLabel}</p>
        {selectedCategoryName && (
          <span className="workspace-filter-note">当前视图：{selectedCategoryName}</span>
        )}
      </div>

      <div className="calendar-header-actions" aria-label="Calendar controls">
        <div className="calendar-view-switch" aria-label="Calendar view">
          <button type="button" className="calendar-view-option is-active">
            月
          </button>
          <button type="button" className="calendar-view-option" disabled>
            周
          </button>
          <button type="button" className="calendar-view-option" disabled>
            日
          </button>
        </div>

        <nav className="calendar-toolbar" aria-label="Month navigation">
          <button type="button" className="calendar-nav-btn" onClick={onPrevMonth}>
            <span aria-hidden>‹</span>
            上个月
          </button>
          <button type="button" className="calendar-today-btn" onClick={onToday}>
            今天
          </button>
          <button type="button" className="calendar-nav-btn" onClick={onNextMonth}>
            下个月
            <span aria-hidden>›</span>
          </button>
        </nav>
      </div>
    </header>
  )
}
