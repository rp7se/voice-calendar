import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  previewSchedule,
  toSchedulingTaskDto,
  type ScheduledTaskDto,
  type SchedulingPreviewResponse,
} from '../../api/schedulingApi.ts'
import { ApiError } from '../../api/eventApi.ts'
import { linkTaskScheduling } from '../../api/taskApi.ts'
import { createEvent } from '../../services/eventDataSource.ts'
import type { EventCategory } from '../../types/calendar.ts'
import type { Task } from '../../types/task.ts'
import { formatDate } from '../../utils/date.ts'
import { formatDuration, PRIORITY_LABELS } from './taskUtils.ts'

type SchedulingPreviewModalProps = {
  tasks: Task[]
  categories: EventCategory[]
  selectedCategoryName?: string | null
  onEventsChange?: () => void
  onTaskSchedulingChange?: (task: Task) => void
  onClose: () => void
}

type ConfirmationFailure = {
  taskId: string
  title: string
  message: string
  stage: 'event' | 'link'
}

type ConfirmationResult = {
  successCount: number
  eventCreatedCount: number
  failures: ConfirmationFailure[]
}

const UNSCHEDULED_REASON_LABELS: Record<string, string> = {
  no_sufficient_contiguous_slot: '没有足够的连续时间',
  missing_estimated_duration: '未设置预计耗时',
  invalid_estimated_duration: '预计耗时无效',
}

function getPreviewErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '暂时无法生成安排，请稍后重试。'
  }
  if (error.status === 0) {
    return '暂时无法生成安排，请确认日程服务是否正常运行。'
  }
  if (error.status === 400) {
    return '排程参数有误，请检查目标日期和可安排时间。'
  }
  if (error.status >= 500) {
    return '排程服务暂时不可用，请稍后重试。'
  }
  return error.message
}

function getCreationFailure(error: unknown, scheduled: ScheduledTaskDto): ConfirmationFailure {
  if (error instanceof ApiError && error.status === 409) {
    return {
      taskId: scheduled.taskId,
      title: scheduled.title,
      message: '该时间段与新日程发生冲突',
      stage: 'event',
    }
  }

  return {
    taskId: scheduled.taskId,
    title: scheduled.title,
    message:
      error instanceof ApiError && error.status >= 500
        ? '日程服务暂时无法创建该项目'
        : error instanceof ApiError && error.status === 400
          ? '创建日程所需的数据无效'
          : '创建该日程失败',
    stage: 'event',
  }
}

function getLinkFailure(error: unknown, scheduled: ScheduledTaskDto): ConfirmationFailure {
  const detail =
    error instanceof ApiError && error.code === 'task_already_scheduled'
      ? '任务已经安排，原有关联未被覆盖'
      : error instanceof ApiError && error.status === 404
        ? '任务或日程已不存在'
        : '日程已创建，但任务关联更新失败；请先处理已创建日程后再重试排程'

  return {
    taskId: scheduled.taskId,
    title: scheduled.title,
    message: `日程已创建，但任务关联更新失败：${detail}`,
    stage: 'link',
  }
}

function getUnscheduledReasonLabel(reason: string): string {
  return UNSCHEDULED_REASON_LABELS[reason] ?? '当前条件下无法安排'
}

export default function SchedulingPreviewModal({
  tasks,
  categories,
  selectedCategoryName = null,
  onEventsChange,
  onTaskSchedulingChange,
  onClose,
}: SchedulingPreviewModalProps) {
  const [schedulingTasks] = useState(() => tasks)
  const [date, setDate] = useState(() => formatDate(new Date()))
  const [rangeStart, setRangeStart] = useState('08:00')
  const [rangeEnd, setRangeEnd] = useState('22:00')
  const [preview, setPreview] = useState<SchedulingPreviewResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const taskById = useMemo(
    () => new Map(schedulingTasks.map((task) => [task.id, task])),
    [schedulingTasks],
  )
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  )

  useEffect(() => {
    const previouslyFocused = document.activeElement
    dateInputRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus()
      }
    }
  }, [isConfirming, onClose])

  const handleClose = () => {
    if (!isConfirming) {
      onClose()
    }
  }

  const handlePreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isPreviewLoading || rangeStart >= rangeEnd) {
      if (rangeStart >= rangeEnd) {
        setErrorMessage('开始时间必须早于结束时间。')
      }
      return
    }

    setErrorMessage('')
    setIsPreviewLoading(true)
    try {
      const result = await previewSchedule({
        date,
        range: { start: rangeStart, end: rangeEnd },
        tasks: schedulingTasks.map(toSchedulingTaskDto),
      })
      setPreview(result)
      setConfirmationResult(null)
      setIsConfirmed(false)
    } catch (error) {
      setErrorMessage(getPreviewErrorMessage(error))
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview || isConfirming || isConfirmed || preview.scheduled.length === 0) {
      return
    }

    setIsConfirming(true)
    setIsConfirmed(true)
    setErrorMessage('')
    const failures: ConfirmationFailure[] = []
    let successCount = 0
    let eventCreatedCount = 0

    for (const scheduled of preview.scheduled) {
      const sourceTask = taskById.get(scheduled.taskId)
      let createdEvent
      try {
        createdEvent = await createEvent({
          title: scheduled.title,
          description: '由任务自动安排生成',
          date: preview.date,
          startTime: scheduled.start,
          endTime: scheduled.end,
          type: 'schedule',
          categoryId: sourceTask?.categoryId,
          reminderMinutesBefore: null,
        })
        eventCreatedCount += 1
      } catch (error) {
        failures.push(getCreationFailure(error, scheduled))
        continue
      }

      try {
        const updatedTask = await linkTaskScheduling(scheduled.taskId, createdEvent.id)
        onTaskSchedulingChange?.(updatedTask)
        successCount += 1
      } catch (error) {
        failures.push(getLinkFailure(error, scheduled))
      }
    }

    if (eventCreatedCount > 0) {
      onEventsChange?.()
    }
    setConfirmationResult({ successCount, eventCreatedCount, failures })
    setIsConfirming(false)
  }

  return (
    <div className="scheduling-overlay" onClick={handleClose}>
      <section
        className="scheduling-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scheduling-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="scheduling-header">
          <div>
            <span>Schedule Planner</span>
            <h2 id="scheduling-title">{preview ? '自动安排预览' : '设置自动安排'}</h2>
          </div>
          <button type="button" onClick={handleClose} disabled={isConfirming}>
            关闭
          </button>
        </header>

        {!preview ? (
          <form className="scheduling-setup" onSubmit={(event) => void handlePreview(event)}>
            <div className="scheduling-scope-note">
              <strong>将安排 {schedulingTasks.length} 个任务</strong>
              <span>
                {selectedCategoryName
                  ? `范围：${selectedCategoryName}分类中的未安排任务`
                  : '范围：全部分类中的未安排任务'}
              </span>
            </div>

            <div className="form-row scheduling-setup-wide">
              <label htmlFor="scheduling-date">目标日期</label>
              <input
                ref={dateInputRef}
                id="scheduling-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="scheduling-start">开始时间</label>
              <input
                id="scheduling-start"
                type="time"
                value={rangeStart}
                onChange={(event) => setRangeStart(event.target.value)}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="scheduling-end">结束时间</label>
              <input
                id="scheduling-end"
                type="time"
                value={rangeEnd}
                onChange={(event) => setRangeEnd(event.target.value)}
                required
              />
            </div>

            {errorMessage && <p className="scheduling-error" role="alert">{errorMessage}</p>}

            <footer className="scheduling-actions scheduling-setup-wide">
              <button type="button" className="scheduling-secondary" onClick={handleClose}>
                取消
              </button>
              <button type="submit" className="scheduling-primary" disabled={isPreviewLoading}>
                {isPreviewLoading ? '正在生成安排...' : '生成安排预览'}
              </button>
            </footer>
          </form>
        ) : (
          <div className="scheduling-preview">
            <section className="scheduling-summary" aria-label="排程摘要">
              <div><span>任务</span><strong>{preview.summary.totalTasks}</strong></div>
              <div><span>已安排</span><strong>{preview.summary.scheduledTasks}</strong></div>
              <div><span>无法安排</span><strong>{preview.summary.unscheduledTasks}</strong></div>
              <div><span>总时长</span><strong>{preview.summary.scheduledMinutes} 分钟</strong></div>
            </section>

            <section className="scheduling-result-section">
              <div className="scheduling-section-heading">
                <div>
                  <span>{preview.date}</span>
                  <h3>安排建议</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null)
                    setErrorMessage('')
                  }}
                  disabled={isConfirming || isConfirmed}
                >
                  调整时间
                </button>
              </div>

              {preview.scheduled.length > 0 ? (
                <ol className="scheduling-timeline">
                  {preview.scheduled.map((scheduled) => {
                    const task = taskById.get(scheduled.taskId)
                    const categoryName = task?.categoryId
                      ? categoryById.get(task.categoryId)
                      : undefined
                    return (
                      <li key={scheduled.taskId}>
                        <time>{scheduled.start} – {scheduled.end}</time>
                        <div>
                          <strong>{scheduled.title}</strong>
                          <span>
                            {task ? PRIORITY_LABELS[task.priority] : '待办任务'}
                            {' · '}{formatDuration(scheduled.durationMinutes)}
                            {categoryName ? ` · ${categoryName}` : ''}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="scheduling-empty">当前条件下没有可以安排的任务。</p>
              )}
            </section>

            {preview.unscheduled.length > 0 && (
              <section className="scheduling-result-section scheduling-unscheduled">
                <div className="scheduling-section-heading">
                  <div>
                    <span>Needs Attention</span>
                    <h3>无法安排</h3>
                  </div>
                </div>
                <ul>
                  {preview.unscheduled.map((task) => (
                    <li key={task.taskId}>
                      <strong>{task.title}</strong>
                      <span>{getUnscheduledReasonLabel(task.reason)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {errorMessage && <p className="scheduling-error" role="alert">{errorMessage}</p>}

            {confirmationResult && (
              <section
                className={`scheduling-confirmation${confirmationResult.failures.length ? ' has-failures' : ''}`}
                role="status"
              >
                <strong>
                  {confirmationResult.successCount} 个任务已成功安排
                  {confirmationResult.failures.length > 0
                    ? `，${confirmationResult.failures.length} 个项目需要处理`
                    : ''}
                </strong>
                {confirmationResult.eventCreatedCount > confirmationResult.successCount && (
                  <span>
                    另有 {confirmationResult.eventCreatedCount - confirmationResult.successCount}
                    个日程已创建，但任务关联未完成。
                  </span>
                )}
                {confirmationResult.failures.length > 0 && (
                  <ul>
                    {confirmationResult.failures.map((failure) => (
                      <li key={failure.taskId}>
                        {failure.title}：{failure.message}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <footer className="scheduling-actions">
              <button
                type="button"
                className="scheduling-secondary"
                onClick={handleClose}
                disabled={isConfirming}
              >
                {isConfirmed ? '关闭' : '取消'}
              </button>
              <button
                type="button"
                className="scheduling-primary"
                onClick={() => void handleConfirm()}
                disabled={isConfirming || isConfirmed || preview.scheduled.length === 0}
              >
                {isConfirming
                  ? '正在创建日程...'
                  : isConfirmed
                    ? '已确认安排'
                    : `确认安排 ${preview.scheduled.length} 项`}
              </button>
            </footer>
          </div>
        )}
      </section>
    </div>
  )
}
