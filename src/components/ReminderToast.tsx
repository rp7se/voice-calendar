import type { ReminderDto } from '../api/reminderApi.ts'

type ReminderToastProps = {
  reminder: ReminderDto
  pendingCount: number
  isAcknowledging: boolean
  errorMessage: string
  onAcknowledge: () => void
}

export default function ReminderToast({
  reminder,
  pendingCount,
  isAcknowledging,
  errorMessage,
  onAcknowledge,
}: ReminderToastProps) {
  return (
    <aside
      className="reminder-toast"
      aria-live="assertive"
      aria-label="日程提醒"
      data-reminder-id={reminder.id}
      data-testid="reminder-toast"
    >
      <div className="reminder-toast-heading">
        <span>日程提醒</span>
        {pendingCount > 1 && <small>另有 {pendingCount - 1} 条</small>}
      </div>
      <strong>{reminder.title}</strong>
      <p>{reminder.date} · {reminder.startTime} 即将开始</p>
      {errorMessage && <p className="reminder-toast-error" role="alert">{errorMessage}</p>}
      <button type="button" onClick={onAcknowledge} disabled={isAcknowledging}>
        {isAcknowledging ? '正在确认…' : '知道了'}
      </button>
    </aside>
  )
}
