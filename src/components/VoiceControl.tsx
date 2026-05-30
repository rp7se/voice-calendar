import { useSpeechRecognition } from '../hooks/useSpeechRecognition.ts'

export default function VoiceControl() {
  const {
    transcript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
  } = useSpeechRecognition()

  const handleToggle = () => {
    if (isListening) {
      stopListening()
      return
    }
    startListening()
  }

  return (
    <section className="voice-control" aria-label="语音输入">
      <div className="voice-control-header">
        <h2 className="section-title">🎙️ 语音输入</h2>
        <p className="voice-control-desc">点击按钮开始说话，识别结果将显示在下方</p>
      </div>

      {!isSupported ? (
        <p className="voice-control-unsupported">
          当前浏览器不支持语音识别，请使用 Chrome 或 Edge 体验此功能。
        </p>
      ) : (
        <>
          <button
            type="button"
            className={`voice-control-btn${isListening ? ' voice-control-btn--listening' : ''}`}
            onClick={handleToggle}
          >
            {isListening ? '正在听...点击停止' : '开始语音输入'}
          </button>

          {error && <p className="voice-control-error">{error}</p>}

          <div className="voice-control-result">
            <span className="voice-control-result-label">识别结果</span>
            <p className="voice-control-transcript">
              {transcript || (isListening ? '请开始说话...' : '暂无识别内容')}
            </p>
          </div>
        </>
      )}
    </section>
  )
}
