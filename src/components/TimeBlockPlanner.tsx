import { useState } from 'react'
import type { EventType } from '../types/calendar.ts'
import { addEvent } from '../utils/storage.ts'

type TimeBlockPlannerProps = {
  selectedDate: string
  onSaved?: () => void
}

type PlannerMode = 'course' | 'work'

const TIME_BLOCKS = [
  { startTime: '08:00', endTime: '09:00' },
  { startTime: '09:00', endTime: '10:00' },
  { startTime: '10:00', endTime: '11:00' },
  { startTime: '11:00', endTime: '12:00' },
  { startTime: '14:00', endTime: '15:00' },
  { startTime: '15:00', endTime: '16:00' },
  { startTime: '16:00', endTime: '17:00' },
  { startTime: '19:00', endTime: '20:00' },
  { startTime: '20:00', endTime: '21:00' },
]

function createEmptyBlocks(): Record<string, string> {
  return Object.fromEntries(
    TIME_BLOCKS.map((block) => [`${block.startTime}-${block.endTime}`, '']),
  )
}

function getModeLabel(mode: PlannerMode): string {
  return mode === 'course' ? '课程表' : '工作表'
}

export default function TimeBlockPlanner({
  selectedDate,
  onSaved,
}: TimeBlockPlannerProps) {
  const [mode, setMode] = useState<PlannerMode | null>(null)
  const [blocks, setBlocks] = useState<Record<string, string>>(() => createEmptyBlocks())

  const startPlanner = (nextMode: PlannerMode) => {
    setMode(nextMode)
    setBlocks(createEmptyBlocks())
  }

  const updateBlock = (key: string, value: string) => {
    setBlocks((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = () => {
    if (!mode) {
      return
    }

    let savedCount = 0
    for (const block of TIME_BLOCKS) {
      const key = `${block.startTime}-${block.endTime}`
      const title = blocks[key]?.trim()
      if (!title) {
        continue
      }

      addEvent({
        title,
        description: `${getModeLabel(mode)}时间格子创建`,
        date: selectedDate,
        startTime: block.startTime,
        endTime: block.endTime,
        type: mode as EventType,
        reminderEnabled: false,
      })
      savedCount += 1
    }

    if (savedCount > 0) {
      onSaved?.()
    }
    setMode(null)
    setBlocks(createEmptyBlocks())
  }

  return (
    <section className="time-block-planner" aria-label="课程表和工作表">
      <div className="time-block-planner-header">
        <div>
          <h3>课程表 / 工作表</h3>
          <p>选择一种时间表，把非空格子保存为当天事项。</p>
        </div>
        <div className="time-block-actions">
          <button type="button" onClick={() => startPlanner('course')}>
            添加课程表
          </button>
          <button type="button" onClick={() => startPlanner('work')}>
            添加工作表
          </button>
        </div>
      </div>

      {mode && (
        <div className="time-block-editor">
          <div className="time-block-editor-title">
            <strong>{getModeLabel(mode)}</strong>
            <span>{selectedDate}</span>
          </div>
          <div className="time-block-grid">
            {TIME_BLOCKS.map((block) => {
              const key = `${block.startTime}-${block.endTime}`
              return (
                <label key={key} className="time-block-card">
                  <span>
                    {block.startTime} - {block.endTime}
                  </span>
                  <input
                    type="text"
                    value={blocks[key]}
                    onChange={(event) => updateBlock(key, event.target.value)}
                    placeholder={mode === 'course' ? '课程名称' : '工作内容'}
                  />
                </label>
              )
            })}
          </div>
          <div className="time-block-footer">
            <button type="button" className="time-block-cancel" onClick={() => setMode(null)}>
              取消
            </button>
            <button type="button" className="time-block-save" onClick={handleSave}>
              保存时间表
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
