# VoiceCalendar

VoiceCalendar 是一个支持语音交互、确定性任务排程和实时提醒的现代日程管理系统：前端使用 React + TypeScript + Vite，后端使用 C++17 + Drogon，Event、Task、Category 与 Reminder Delivery 持久化到 SQLite。


> 该视频是项目既有演示入口；当前仓库的 VoiceCalendar 2.0 在其基础上继续加入了 C++ Backend、Tasks、自动排程和实时 Reminder 等能力。

## Features

- **Today Workspace**：聚合今日事件、任务、时间线和下一项安排。
- **Calendar Workspace**：月历、日期详情、节日、课程表/工作表时间格子及 Event CRUD。
- **Tasks Workspace**：Task 创建、编辑、完成、删除、优先级、Deadline 和预计耗时管理。
- **Categories**：Category CRUD、Event/Task 分类关联和侧边栏筛选；删除分类时保留业务数据并清空关联。
- **Voice Commands**：基于 Web Speech API 与本地规则解析器完成日程创建、查询、删除、总结、倒计时查询等操作，并通过 TTS 反馈。
- **Voice Orb 与 Command Palette**：统一语音入口、快捷导航、文本指令以及 Event/Task/Category 搜索。
- **Conflict Detection**：创建或编辑有结束时间的 Event 时检测同日区间重叠，并返回冲突详情。
- **Free Time Query**：裁剪并合并忙碌区间，计算指定日期和时间范围内的空闲时段。
- **Task Auto Scheduling**：根据 Deadline、Priority、Estimated Duration 和可用时间生成可解释的确定性排程预览。
- **Scheduling Confirmation**：确认预览后创建对应 Event，并保存 Task → Event 排程关系。
- **Reminder System**：Event 提醒配置、后台扫描、Delivery 持久化、SSE 推送、React Toast、TTS 和 ACK。
- **Countdown 与 Focus Mode**：本地倒计时、漂浮气泡和专注视图。

## Architecture

```text
React + TypeScript Frontend
        │
        ├── REST：Event / Task / Category / Scheduling / Reminder API
        └── SSE：实时 Reminder Stream
        │
        ▼
C++17 + Drogon Backend
        │
        ├── Controller：HTTP 路由、请求验证、统一错误响应
        ├── Service：冲突检测、空闲时间、任务排程、后台提醒
        └── Repository：参数化 SQL 与事务边界
        │
        ▼
SQLite
```

Event、Task、Category 和 Reminder Delivery 的运行时数据以 Backend/SQLite 为准。Countdown 和 Category-Date Link 仍保存在浏览器 localStorage；旧版 Event、Task、Category localStorage 数据只用于一次性迁移与备份，不参与 Backend 模式下的双写。

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19、TypeScript、Vite、CSS |
| Browser APIs | Web Speech API、SpeechSynthesis、Web Audio API、EventSource、HTML5 Drag and Drop |
| Backend | C++17、Drogon、Trantor、CMake |
| Persistence | SQLite、版本化 SQL Migration |
| Dependencies | npm、vcpkg Manifest Mode |

## Core Backend Capabilities

- Drogon REST API 与 SSE 流式响应。
- Event、Task、Category、Reminder 的 Controller / Service / Repository 分层。
- SQLite 持久化、参数化 SQL、事务和启动时 Schema Migration。
- `[start, end)` 区间冲突检测与冲突 Payload。
- 忙碌区间裁剪、排序和合并后的 Free Time 计算。
- C++ 确定性 Task Scheduler。
- 常驻 Backend EventLoop 上的 ReminderService 与 Delivery 去重持久化。
- 集中的 BackendConfig、环境变量验证、统一 API Error 和 Drogon/Trantor Logging。

## Auto Scheduling

当前排程器是**可解释的确定性贪心算法**，不是 AI、Machine Learning 或全局最优求解器。

1. Backend 读取目标日期内已有 Event，合并忙碌区间并计算可用时间。
2. 已完成或已经建立排程关系的 Task 不参与本次安排；缺少或包含非法预计耗时的 Task 会返回明确原因。
3. 可安排 Task 依次按以下规则稳定排序：
   - 有 Deadline 的任务优先；
   - Deadline 日期、时间更早的优先；
   - Priority 按 High、Medium、Low；
   - 同条件下预计耗时更长的优先；
   - 最后保持请求输入顺序。
4. 每个 Task 使用 First Fit 放入最早能够完整容纳其 Estimated Duration 的连续空闲区间。
5. `POST /api/scheduling/preview` 只返回预览，不写数据库。用户确认后，Frontend 逐项创建 Event，再调用 Task Scheduling Relation API 保存关联。

## Reminder System

```text
Event Reminder Configuration
        ↓
SQLite Event Persistence
        ↓
C++ ReminderService 定时扫描
        ↓
Reminder Delivery Persistence (SQLite)
        ↓
SSE /api/reminders/stream
        ↓
React Toast + TTS
        ↓
POST ACK
```

只要 C++ Backend 仍在运行，ReminderService 就能继续扫描并生成持久化的 Reminder Delivery，即使 React 页面暂时关闭。实时 Toast 和 TTS 依赖 Frontend 页面打开并连接 SSE；Backend 关闭后不会继续生成或推送提醒。

## Project Structure

```text
voice-calendar/
├── backend/
│   ├── migrations/          # SQLite Schema Migration
│   ├── src/
│   │   ├── config/          # BackendConfig
│   │   ├── controllers/     # Drogon HTTP Controller
│   │   ├── database/        # Database 初始化与 Migration
│   │   ├── http/            # JSON 转换与统一响应
│   │   ├── models/          # Backend 领域模型
│   │   ├── repositories/    # SQLite 数据访问
│   │   ├── services/        # Conflict、Free Time、Scheduler、Reminder
│   │   └── utils/           # 日期与 Reminder 时间工具
│   ├── tests/               # Backend 单元测试
│   ├── CMakeLists.txt
│   └── vcpkg.json
├── public/                  # 静态资源
├── scripts/                 # Migration 与 Backend 集成回归脚本
├── src/
│   ├── api/                 # REST / Reminder API Client
│   ├── components/          # Workspace 与 UI 组件
│   ├── hooks/               # Speech / Reminder Hooks
│   ├── migrations/          # Legacy localStorage 迁移
│   ├── services/            # 数据源与 SSE Client
│   ├── types/               # TypeScript 模型
│   └── utils/               # 日期、存储、语音指令等工具
├── .env.example
├── package.json
└── vite.config.ts
```

## Getting Started

### Prerequisites

本项目主要在 Windows 环境开发和验证，需要：

- Node.js 与 npm
- Visual Studio 2022 Build Tools，并安装 Desktop development with C++
- CMake 3.20 或更高版本
- vcpkg，并设置 `VCPKG_ROOT`

以下命令均在仓库根目录执行，不需要写入私人绝对路径。

### 1. 安装 Frontend 依赖

```powershell
npm.cmd install
```

### 2. 配置 Backend

```powershell
cmake -S backend -B backend/build -G "Visual Studio 17 2022" -A x64 -DCMAKE_TOOLCHAIN_FILE="$env:VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake"
```

vcpkg 会根据 `backend/vcpkg.json` 安装 Drogon 及 SQLite 支持。

### 3. 构建 Backend

```powershell
cmake --build backend/build --config Debug
```

### 4. 启动 Backend

```powershell
.\backend\build\Debug\voicecalendar_backend.exe
```

默认监听 `http://127.0.0.1:8080`。可用以下命令确认服务：

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
```

### 5. 启动 Frontend

保持 Backend 运行，在另一个终端执行：

```powershell
npm.cmd run dev
```

打开 `http://localhost:5173/`。Vite 会将 `/api` 代理到默认 Backend。语音识别建议使用支持 Web Speech API 的 Chrome；不支持时页面会显示降级状态。

### 6. 发布构建与检查

```powershell
npm.cmd run build
npm.cmd run lint
```

## Backend Configuration

Backend 在启动时读取以下真实支持的环境变量：

| Variable | Purpose | Default | Validation |
| --- | --- | --- | --- |
| `VOICECALENDAR_HOST` | HTTP 监听地址 | `127.0.0.1` | 不得为空 |
| `VOICECALENDAR_PORT` | HTTP 监听端口 | `8080` | `1`–`65535` 的整数 |
| `VOICECALENDAR_DB_PATH` | SQLite 数据库路径 | `backend/data/voicecalendar.db` | 不得为空；相对路径基于仓库根目录 |
| `VOICECALENDAR_REMINDER_SCAN_SECONDS` | Reminder 扫描间隔 | `30` | 至少 `1` 秒的整数 |

PowerShell 示例：

```powershell
$env:VOICECALENDAR_PORT = "8081"
$env:VOICECALENDAR_DB_PATH = "backend/data/dev.db"
$env:VOICECALENDAR_REMINDER_SCAN_SECONDS = "10"
.\backend\build\Debug\voicecalendar_backend.exe
```

Frontend 可复制 `.env.example` 为不提交 Git 的 `.env.local`：

| Variable | Purpose | Default example |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Frontend API Base URL | `/api` |
| `VITE_EVENT_DATA_SOURCE` | Event 数据源；正常运行使用 Backend | `backend` |

## API Overview

| Capability | Method and Path | Notes |
| --- | --- | --- |
| Health | `GET /api/health` | 服务状态 |
| Events | `GET/POST /api/events` | 列表、创建 |
| Event | `GET/PUT/DELETE /api/events/{id}` | 查询、编辑、删除 |
| Tasks | `GET/POST /api/tasks` | 列表、创建 |
| Task | `GET/PUT/DELETE /api/tasks/{id}` | 查询、编辑/完成、删除 |
| Task Scheduling Relation | `PUT /api/tasks/{id}/scheduling` | 保存 Task → Event 关系 |
| Categories | `GET/POST /api/categories` | 列表、创建 |
| Category | `GET/PUT/DELETE /api/categories/{id}` | 查询、编辑、删除 |
| Free Time | `GET /api/free-time?date=YYYY-MM-DD&start=HH:mm&end=HH:mm` | 指定范围的空闲区间 |
| Scheduling Preview | `POST /api/scheduling/preview` | 非持久化排程预览 |
| Pending Reminders | `GET /api/reminders/pending` | 未 ACK Delivery |
| Reminder ACK | `POST /api/reminders/{id}/ack` | 确认 Reminder |
| Reminder Stream | `GET /api/reminders/stream` | SSE Reminder 与 Heartbeat |

API 错误响应统一包含 `error` 和 `message`；冲突等业务错误可以包含额外字段，例如 `event_conflict.conflicts`。

## Development Workflow

项目采用 Incremental PR Development：每个 PR 聚焦一个清晰功能或重构，通过小步、可验证的变更持续迭代。提交前应运行相关 Frontend build/lint、Backend build/test 和必要的 API 回归。

## Future Improvements

以下仅为未来方向，当前版本尚未实现：

- Habit-based Prefill
- AI-assisted Natural Language Understanding
- Route / Schedule Optimization
- Cross-device Sync
- System-level Background Reminder

## License / Notes

本项目为课程与个人作品集项目，核心业务逻辑和交互围绕 VoiceCalendar 自行实现。仓库当前未提供独立 LICENSE 文件；如需复用或分发，请先向项目所有者确认授权范围。
