import './App.css'

const FEATURE_TAGS = ['语音交互', '日历管理', '倒计时', '日程总结']

const PLANNED_FEATURES = [
  '语音添加、查看与删除日程',
  '节日显示与倒计时卡片',
  '当日详情页与分类文件夹',
  '语音总结与语音播报',
]

function App() {
  return (
    <main className="app">
      <section className="intro-card">
        <h1>voice-calendar</h1>
        <p className="intro-desc">面向学习、工作和竞赛场景的语音日程管理系统</p>

        <div className="feature-tags">
          {FEATURE_TAGS.map((tag) => (
            <span key={tag} className="feature-tag">
              {tag}
            </span>
          ))}
        </div>

        <div className="planned-section">
          <h2>功能规划</h2>
          <ul>
            {PLANNED_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>

        <p className="status-note">项目初始化中，功能开发即将开始</p>
      </section>
    </main>
  )
}

export default App
