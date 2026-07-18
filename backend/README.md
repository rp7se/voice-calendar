# VoiceCalendar C++ Backend

VoiceCalendar Backend 是基于 C++17、Drogon 和 SQLite 的本地日程服务，负责 Event、Task、Category、Scheduling 和 Reminder 的持久化与业务规则。

## Responsibilities

- Event、Task、Category CRUD
- Event 时间区间冲突检测
- Free Time 区间计算
- 确定性 Task Scheduling Preview
- Task → Event Scheduling Relation
- Event Reminder 配置与 Delivery 持久化
- 后台 ReminderService、SSE 推送与 ACK
- 集中配置、统一 API Error 和 Drogon/Trantor Logging

## Architecture

Backend 按职责分层：

- `controllers/`：Drogon 路由、输入验证、HTTP Status 和统一错误响应。
- `services/`：Conflict Detection、Free Time、Task Scheduler、Reminder 扫描与 SSE。
- `repositories/`：参数化 SQL、查询和事务。
- `models/`：Event、Task、Category、Scheduling、Reminder 领域模型。
- `database/`：SQLite Client、Migration 执行和 Schema 校验。
- `config/`：环境变量加载和启动前验证。
- `http/`：JSON 解析、序列化和 Response Helper。

## Tech Stack

- C++17
- Drogon / Trantor
- SQLite
- CMake 3.20+
- vcpkg Manifest Mode
- MSVC / Visual Studio 2022 Build Tools

## Directory Structure

```text
backend/
├── migrations/       # 版本化 SQLite Migration
├── src/
│   ├── config/
│   ├── controllers/
│   ├── database/
│   ├── http/
│   ├── models/
│   ├── repositories/
│   ├── services/
│   └── utils/
├── tests/
├── CMakeLists.txt
└── vcpkg.json
```

## Build and Run

### Prerequisites

- Visual Studio 2022 Build Tools，包含 C++ Desktop workload
- CMake
- vcpkg
- 已设置 `VCPKG_ROOT`

在仓库根目录执行：

```powershell
cmake -S backend -B backend/build -G "Visual Studio 17 2022" -A x64 -DCMAKE_TOOLCHAIN_FILE="$env:VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake"
cmake --build backend/build --config Debug
.\backend\build\Debug\voicecalendar_backend.exe
```

CMake Target 和可执行文件名为 `voicecalendar_backend`；Debug 构建位于 `backend/build/Debug/voicecalendar_backend.exe`。

启动后验证：

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
```

## Configuration

| Variable | Purpose | Default | Validation |
| --- | --- | --- | --- |
| `VOICECALENDAR_HOST` | HTTP 监听地址 | `127.0.0.1` | 不得为空 |
| `VOICECALENDAR_PORT` | HTTP 监听端口 | `8080` | `1`–`65535` 的整数 |
| `VOICECALENDAR_DB_PATH` | SQLite 文件 | `backend/data/voicecalendar.db` | 不得为空；相对路径基于仓库根目录 |
| `VOICECALENDAR_REMINDER_SCAN_SECONDS` | ReminderService 扫描间隔 | `30` | 至少 `1` 秒的整数 |

非法 Port 或扫描间隔会让 Backend 明确拒绝启动，不会截断或静默回退。默认数据库和相对数据库路径不依赖启动 Working Directory；无法可靠定位 Backend 源码目录时也会拒绝启动，避免意外创建第二个空数据库。

PowerShell 示例：

```powershell
$env:VOICECALENDAR_HOST = "127.0.0.1"
$env:VOICECALENDAR_PORT = "8081"
$env:VOICECALENDAR_DB_PATH = "backend/data/dev.db"
$env:VOICECALENDAR_REMINDER_SCAN_SECONDS = "10"
.\backend\build\Debug\voicecalendar_backend.exe
```

测试结束后可清除覆盖：

```powershell
Remove-Item Env:VOICECALENDAR_HOST -ErrorAction SilentlyContinue
Remove-Item Env:VOICECALENDAR_PORT -ErrorAction SilentlyContinue
Remove-Item Env:VOICECALENDAR_DB_PATH -ErrorAction SilentlyContinue
Remove-Item Env:VOICECALENDAR_REMINDER_SCAN_SECONDS -ErrorAction SilentlyContinue
```

## Database and Migrations

默认数据库为 `backend/data/voicecalendar.db`。Backend 启动时按顺序执行并记录以下 Migration：

1. `001_create_events.sql`
2. `002_create_tasks.sql`
3. `003_create_categories.sql`
4. `004_add_task_scheduling_relation.sql`
5. `005_add_event_reminders.sql`

Migration 通过 `schema_migrations` 保证幂等，并在启动后校验 Event、Task、Category、Scheduling Relation 和 Reminder Schema。数据库、WAL、SHM 和 Build 产物均由 `.gitignore` 排除。

## API Overview

```text
GET    /api/health

GET    /api/events
GET    /api/events/{id}
POST   /api/events
PUT    /api/events/{id}
DELETE /api/events/{id}

GET    /api/tasks
GET    /api/tasks/{id}
POST   /api/tasks
PUT    /api/tasks/{id}
PUT    /api/tasks/{id}/scheduling
DELETE /api/tasks/{id}

GET    /api/categories
GET    /api/categories/{id}
POST   /api/categories
PUT    /api/categories/{id}
DELETE /api/categories/{id}

GET    /api/free-time?date=YYYY-MM-DD&start=HH:mm&end=HH:mm
POST   /api/scheduling/preview

GET    /api/reminders/pending
GET    /api/reminders/stream
POST   /api/reminders/{id}/ack
```

## API Errors

基础错误结构统一为：

```json
{
  "error": "event_not_found",
  "message": "Event not found"
}
```

业务错误保留机器可读 Code 和 HTTP `400/404/409`。系统异常使用 HTTP `500` 与 `internal_error`。`event_conflict` 还会返回 `conflicts` 数组；正常用户输入错误不会全部记录为系统 ERROR。

## Conflict and Free Time

- Event Conflict 使用同日 `[start, end)` 区间判断，因此相邻区间不冲突。
- 无结束时间的 Event 不占用区间，也不参与区间冲突。
- Free Time 会将 Event 裁剪到查询范围，排序并合并重叠/相邻忙碌区间，再返回剩余连续空闲区间。

## Auto Scheduling

`POST /api/scheduling/preview` 是非持久化预览。Scheduler：

1. 从现有 Event 计算目标范围内的连续 Free Time。
2. 跳过已完成或已安排 Task，并标记缺少/非法 Estimated Duration 的任务。
3. 按 Deadline 是否存在、Deadline 日期/时间、Priority、较长耗时、输入顺序进行稳定排序。
4. 使用 First Fit 将任务放入最早可完整容纳它的空闲区间。

响应中的 `strategy` 为 `edf_priority_first_fit_v1`。这是确定性贪心策略，不宣称 AI、Machine Learning 或全局最优。

## Reminder System

Reminder 流程：

```text
Event Reminder Configuration
  → SQLite event persistence
  → ReminderService scan
  → reminder_deliveries persistence (SQLite)
  → SSE stream
  → Frontend Toast / TTS
  → ACK
```

`ReminderService` 在 Drogon EventLoop 上按配置间隔运行。符合触发条件的 Delivery 先持久化并去重，再通过 SSE 广播。Frontend 关闭时 Backend 仍可继续生成 Delivery；实时 Toast/TTS 需要 Frontend 保持连接。Backend 关闭后不会继续扫描或推送。

Reminder API：

- `GET /api/reminders/pending`：获取未 ACK Delivery。
- `GET /api/reminders/stream`：建立 SSE，接收 `heartbeat` 与 `reminder` Event。
- `POST /api/reminders/{id}/ack`：将 Delivery 标记为 acknowledged。

## Validation

```powershell
cmake --build backend/build --config Debug
ctest --test-dir backend/build -C Debug --output-on-failure
node scripts/test-backend-infrastructure.mjs
```

最后一条命令需从仓库根目录执行，覆盖配置、数据库兼容、API Error、CRUD、Scheduling、Reminder、SSE 与 ACK。
