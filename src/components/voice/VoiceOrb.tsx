import type { VoiceRuntimeStatus } from '../VoiceControl.tsx'

type VoiceOrbProps = {
  status: VoiceRuntimeStatus
  onToggleListening: () => void
  isHidden?: boolean
}

function getOrbLabel(status: VoiceRuntimeStatus): string {
  if (!status.isSupported) {
    return '当前浏览器不支持语音输入'
  }
  if (status.phase === 'listening') {
    return '停止语音输入'
  }
  return '开始语音输入'
}

export default function VoiceOrb({
  status,
  onToggleListening,
  isHidden = false,
}: VoiceOrbProps) {
  const isActive = status.phase !== 'idle'
  const statusLabel =
    status.phase === 'listening'
      ? '正在聆听'
      : status.phase === 'processing'
        ? '正在处理'
        : status.phase === 'speaking'
          ? '正在播报'
          : status.phase === 'error'
            ? '识别失败'
            : ''

  return (
    <button
      type="button"
      className={`voice-orb voice-orb--${status.phase}${
        status.wakeWordEnabled ? ' voice-orb--wake' : ''
      }${isHidden ? ' voice-orb--hidden' : ''}`}
      aria-label={getOrbLabel(status)}
      aria-pressed={status.phase === 'listening'}
      disabled={!status.isSupported}
      onClick={onToggleListening}
    >
      <span className="voice-orb-rings" aria-hidden />
      <span className="voice-orb-core" aria-hidden>
        <span className="voice-orb-dot" />
      </span>
      {(isActive || status.wakeWordEnabled) && (
        <span className="voice-orb-status">
          {status.wakeWordEnabled && <span>唤醒词已开启</span>}
          {statusLabel && <strong>{statusLabel}</strong>}
        </span>
      )}
    </button>
  )
}
