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
