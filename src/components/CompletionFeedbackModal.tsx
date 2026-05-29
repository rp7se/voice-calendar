import { useEffect, useMemo, useState } from 'react'
import type { CountdownItem } from '../types/calendar.ts'
import { deleteCountdown } from '../utils/storage.ts'
import { playCompletionSuccessTone, playEncouragementTone } from '../utils/feedbackAudio.ts'

type CompletionFeedbackModalProps = {
  countdown: CountdownItem | null
  onClose: () => void
  onDeleted: () => void
}

type ModalStep = 'confirm' | 'feedback'
type FeedbackOutcome = 'completed' | 'not-yet'

const COMPLETED_POEMS = [
  '长风破浪会有时，直挂云帆济沧海。',
  '会当凌绝顶，一览众山小。',
  '黄沙百战穿金甲，不破楼兰终不还。',
]

const NOT_YET_POEMS = [
  '山重水复疑无路，柳暗花明又一村。',
  '行到水穷处，坐看云起时。',
  '莫愁前路无知己，天下谁人不识君。',
]

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export default function CompletionFeedbackModal({
  countdown,
  onClose,
  onDeleted,
}: CompletionFeedbackModalProps) {
  const [step, setStep] = useState<ModalStep>('confirm')
  const [outcome, setOutcome] = useState<FeedbackOutcome | null>(null)

  useEffect(() => {
    setStep('confirm')
    setOutcome(null)
  }, [countdown?.id])

  const poem = useMemo(() => {
    if (outcome === 'completed') {
      return pickRandom(COMPLETED_POEMS)
    }
    if (outcome === 'not-yet') {
      return pickRandom(NOT_YET_POEMS)
    }
    return ''
  }, [outcome])

  if (!countdown) {
    return null
  }

  const handleOverlayClick = () => {
    if (step === 'confirm') {
      onClose()
    }
  }

  const handleCancel = () => {
    onClose()
  }

  const handleCompleted = () => {
    setOutcome('completed')
    setStep('feedback')
    playCompletionSuccessTone()
    deleteCountdown(countdown.id)
    onDeleted()
  }

  const handleNotYet = () => {
    setOutcome('not-yet')
    setStep('feedback')
    playEncouragementTone()
    deleteCountdown(countdown.id)
    onDeleted()
  }

  const handleDismissFeedback = () => {
    onClose()
  }

  return (
    <div
      className="completion-modal-overlay"
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        className="completion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        {step === 'confirm' ? (
          <>
            <header className="completion-modal-header">
              <h2 id="completion-modal-title">{countdown.title}</h2>
              <p className="completion-modal-question">这个目标完成了吗？</p>
            </header>
            <div className="completion-modal-actions">
              <button
                type="button"
                className="completion-btn completion-btn--done"
                onClick={handleCompleted}
              >
                完成了
              </button>
              <button
                type="button"
                className="completion-btn completion-btn--pending"
                onClick={handleNotYet}
              >
                还没有
              </button>
              <button
                type="button"
                className="completion-btn completion-btn--cancel"
                onClick={handleCancel}
              >
                取消
              </button>
            </div>
          </>
        ) : (
          <div className="completion-modal-feedback">
            {outcome === 'completed' ? (
              <>
                <p className="completion-feedback-emoji" aria-hidden>
                  🎉
                </p>
                <h2>恭喜完成目标！</h2>
                <p className="completion-feedback-message">
                  「{countdown.title}」已达成，继续保持这份冲劲！
                </p>
              </>
            ) : (
              <>
                <p className="completion-feedback-emoji" aria-hidden>
                  💪
                </p>
                <h2>没关系，继续加油</h2>
                <p className="completion-feedback-message">
                  「{countdown.title}」还在路上，下一步会更接近目标。
                </p>
              </>
            )}
            <blockquote className="completion-poem">{poem}</blockquote>
            <button
              type="button"
              className="completion-btn completion-btn--done completion-btn--wide"
              onClick={handleDismissFeedback}
            >
              好的
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
