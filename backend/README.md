# VoiceCalendar Backend

VoiceCalendar C++ backend skeleton for PR25.

## 技术栈

- C++17
- CMake
- Drogon
- vcpkg Manifest Mode
- MSVC / Visual Studio 2022 Build Tools

## 当前功能

- 启动本地 HTTP Server
- 监听 `127.0.0.1:8080`
- 提供 `GET /api/health`
- 启动时初始化 SQLite 数据库
- 自动创建 `events` 表

## 环境要求

- Visual Studio 2022 Build Tools
- CMake
- vcpkg
- 已设置 `VCPKG_ROOT`
- 存在 `$env:VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake`

## CMake 配置

在仓库根目录执行：

```powershell
cmake -S backend -B backend/build -G "Visual Studio 17 2022" -A x64 -DCMAKE_TOOLCHAIN_FILE="$env:VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake"
```

依赖由 `backend/vcpkg.json` 声明，CMake configure 阶段会通过 vcpkg manifest mode 安装项目依赖。

## Backend 配置

Backend 在启动时读取以下环境变量；未设置时使用安全默认值：

| 环境变量 | 默认值 | 验证规则 |
| --- | --- | --- |
| `VOICECALENDAR_HOST` | `127.0.0.1` | 不得为空 |
| `VOICECALENDAR_PORT` | `8080` | `1`～`65535` 的整数 |
| `VOICECALENDAR_DB_PATH` | `backend/data/voicecalendar.db` | 不得为空 |
| `VOICECALENDAR_REMINDER_SCAN_SECONDS` | `30` | 大于等于 `1` 的整数秒数 |

环境变量优先于默认值。Port 或 Reminder 扫描间隔等配置非法时，Backend 会记录明确错误并拒绝启动，不会静默回退或截断。`VOICECALENDAR_DB_PATH` 使用绝对路径时保持原值；使用相对路径时始终相对于仓库根目录解析，不依赖启动时的 Working Directory。

PowerShell 示例：

```powershell
$env:VOICECALENDAR_PORT = "8081"
$env:VOICECALENDAR_DB_PATH = "backend/data/dev.db"
$env:VOICECALENDAR_REMINDER_SCAN_SECONDS = "10"
.\backend\build\Debug\voicecalendar_backend.exe
```

测试结束后可移除覆盖：

```powershell
Remove-Item Env:VOICECALENDAR_PORT -ErrorAction SilentlyContinue
Remove-Item Env:VOICECALENDAR_DB_PATH -ErrorAction SilentlyContinue
Remove-Item Env:VOICECALENDAR_REMINDER_SCAN_SECONDS -ErrorAction SilentlyContinue
```

默认数据库路径继续通过项目的 `backend` 源码目录解析；从仓库根目录、`backend` 目录或其他 Working Directory 启动都会打开同一个 `backend/data/voicecalendar.db`。若无法可靠定位源码目录，Backend 会拒绝启动，不会猜测路径并创建第二个默认数据库。数据库文件、WAL 和 SHM 文件不会提交到 Git；`backend/data/.gitkeep` 仅用于保留目录。

## 编译

```powershell
cmake --build backend/build --config Debug
```

## 启动

```powershell
.\backend\build\Debug\voicecalendar_backend.exe
```

## Health API 测试

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
```

预期返回：

```json
{
  "service": "voicecalendar-backend",
  "status": "ok",
  "version": "0.1.0"
}
```

## Event API

```text
GET    /api/events
GET    /api/events/{id}
POST   /api/events
PUT    /api/events/{id}
DELETE /api/events/{id}
GET    /api/free-time?date=2026-07-20&start=08:00&end=22:00
POST   /api/scheduling/preview
```

`POST` and `PUT` reject overlapping same-day `[startTime, endTime)` ranges with
HTTP `409` and the machine-readable error code `event_conflict`.

`GET /api/free-time` returns the free `[start, end)` slots within the requested
same-day time range, including each slot's `durationMinutes`.

`POST /api/scheduling/preview` returns a deterministic, non-persistent task
schedule preview. It reads Events but does not create or update them.
