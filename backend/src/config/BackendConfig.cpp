#include "config/BackendConfig.h"

#include <charconv>
#include <cstdlib>
#include <limits>
#include <string_view>

namespace voicecalendar::config
{
namespace
{
constexpr std::string_view kHostEnv = "VOICECALENDAR_HOST";
constexpr std::string_view kPortEnv = "VOICECALENDAR_PORT";
constexpr std::string_view kDatabasePathEnv = "VOICECALENDAR_DB_PATH";
constexpr std::string_view kReminderScanSecondsEnv =
    "VOICECALENDAR_REMINDER_SCAN_SECONDS";

constexpr std::string_view kDefaultHost = "127.0.0.1";
constexpr unsigned int kDefaultPort = 8080;
constexpr unsigned int kDefaultReminderScanSeconds = 30;

const char* environmentValue(std::string_view name)
{
    return std::getenv(std::string(name).c_str());
}

std::string stringSetting(std::string_view name, std::string_view defaultValue)
{
    const auto* value = environmentValue(name);
    if (value == nullptr)
    {
        return std::string(defaultValue);
    }
    if (*value == '\0')
    {
        throw ConfigError(std::string(name) + " must not be empty");
    }
    return value;
}

unsigned int unsignedSetting(
    std::string_view name,
    unsigned int defaultValue,
    unsigned int minimum,
    unsigned int maximum)
{
    const auto* value = environmentValue(name);
    if (value == nullptr)
    {
        return defaultValue;
    }

    const std::string_view text(value);
    unsigned int parsed = 0;
    const auto [end, error] = std::from_chars(
        text.data(),
        text.data() + text.size(),
        parsed);
    if (error != std::errc{} || end != text.data() + text.size() ||
        parsed < minimum || parsed > maximum)
    {
        throw ConfigError(
            std::string(name) + " must be an integer between " +
            std::to_string(minimum) + " and " + std::to_string(maximum));
    }
    return parsed;
}

bool isBackendRoot(const std::filesystem::path& path)
{
    return path.filename() == "backend" &&
        std::filesystem::exists(path / "CMakeLists.txt");
}

std::filesystem::path resolveBackendRoot()
{
    auto current = std::filesystem::current_path();
    while (true)
    {
        if (isBackendRoot(current))
        {
            return current;
        }

        const auto candidate = current / "backend";
        if (isBackendRoot(candidate))
        {
            return candidate;
        }

        if (current == current.root_path())
        {
            break;
        }
        current = current.parent_path();
    }

#ifdef VOICECALENDAR_BACKEND_SOURCE_DIR
    const std::filesystem::path configuredRoot(VOICECALENDAR_BACKEND_SOURCE_DIR);
    if (isBackendRoot(configuredRoot))
    {
        return configuredRoot;
    }
#endif

    throw ConfigError(
        "Unable to locate the VoiceCalendar backend directory; start from the "
        "repository or rebuild the Backend from its current source location");
}
} // namespace

BackendConfig BackendConfig::load()
{
    BackendConfig config;
    config.host = stringSetting(kHostEnv, kDefaultHost);
    config.port = static_cast<std::uint16_t>(unsignedSetting(
        kPortEnv,
        kDefaultPort,
        1,
        std::numeric_limits<std::uint16_t>::max()));
    config.backendRoot = resolveBackendRoot().lexically_normal();

    const auto* databasePath = environmentValue(kDatabasePathEnv);
    if (databasePath == nullptr)
    {
        config.databasePath = config.backendRoot / "data" / "voicecalendar.db";
    }
    else if (*databasePath == '\0')
    {
        throw ConfigError(std::string(kDatabasePathEnv) + " must not be empty");
    }
    else
    {
        config.databasePath = std::filesystem::path(databasePath);
        if (config.databasePath.is_relative())
        {
            config.databasePath = config.backendRoot.parent_path() / config.databasePath;
        }
    }
    config.databasePath = std::filesystem::absolute(config.databasePath).lexically_normal();

    config.reminderScanInterval = std::chrono::seconds(unsignedSetting(
        kReminderScanSecondsEnv,
        kDefaultReminderScanSeconds,
        1,
        std::numeric_limits<unsigned int>::max()));
    return config;
}

} // namespace voicecalendar::config
