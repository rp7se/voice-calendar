import type { Task } from '../../types/task.ts'
import {
  formatDuration,
  getTaskOverview,
  getTodayWorkloadMinutes,
} from './taskUtils.ts'

type TasksContextPanelProps = {
  tasks: Task[]
  selectedCategoryName?: string | null
  onAutoSchedule?: () => void
}

export default function TasksContextPanel({
  tasks,
  selectedCategoryName = null,
  onAutoSchedule,
}: TasksContextPanelProps) {
  const overview = getTaskOverview(tasks)
  const workloadMinutes = getTodayWorkloadMinutes(tasks)
  const pendingCount = tasks.filter((task) => task.status === 'pending').length

  return (
    <div className="tasks-context-stack">
      {selectedCategoryName && (
        <section className="tasks-context-card">
          <span className="today-context-kicker">Current Category</span>
          <h3>{selectedCategoryName}</h3>
          <p>当前任务视图已按此分类聚焦。</p>
        </section>
      )}

      <section className="tasks-context-card">
        <span className="today-context-kicker">Task Overview</span>
        <h3>任务概览</h3>
        <dl className="task-overview-grid">
          <div>
            <dt>待完成</dt>
            <dd>{overview.pendingCount}</dd>
          </div>
          <div>
            <dt>今日到期</dt>
            <dd>{overview.dueTodayCount}</dd>
          </div>
          <div>
            <dt>已完成</dt>
            <dd>{overview.completedCount}</dd>
          </div>
        </dl>
      </section>

      <section className="tasks-context-card">
        <span className="today-context-kicker">Estimated Workload</span>
        <h3>今日预计任务时间</h3>
        <strong className="task-workload-value">
          {workloadMinutes > 0 ? formatDuration(workloadMinutes).replace('预计 ', '') : '暂无'}
        </strong>
        <p>统计今日到期且未完成任务的预计耗时。</p>
      </section>

      <section className="tasks-context-card tasks-auto-card">
        <span className="today-context-kicker">Auto Schedule</span>
        <h3>自动安排</h3>
        <p>
          {pendingCount > 0
            ? `将安排当前范围内的 ${pendingCount} 个待完成任务。`
            : '暂无需要安排的任务。'}
        </p>
        <button type="button" onClick={onAutoSchedule} disabled={pendingCount === 0}>
          自动安排
        </button>
      </section>
    </div>
  )
}
