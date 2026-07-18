#include "config/BackendConfig.h"

#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <optional>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace
{
constexpr const char* kEnvironmentNames[] = {
    "VOICECALENDAR_HOST",
    "VOICECALENDAR_PORT",
    "VOICECALENDAR_DB_PATH",
    "VOICECALENDAR_REMINDER_SCAN_SECONDS",
};

void setEnvironment(const char* name, const std::optional<std::string>& value)
{
#ifdef _WIN32
    if (_putenv_s(name, value ? value->c_str() : "") != 0)
    {
        throw std::runtime_error(std::string("Unable to set environment variable ") + name);
    }
#else
    const auto result = value
        ? setenv(name, value->c_str(), 1)
        : unsetenv(name);
    if (result != 0)
    {
        throw std::runtime_error(std::string("Unable to set environment variable ") + name);
    }
#endif
}

class EnvironmentGuard
{
public:
    EnvironmentGuard()
    {
        for (const auto* name : kEnvironmentNames)
        {
            const auto* value = std::getenv(name);
            originalValues_.emplace_back(
                name,
                value == nullptr
                    ? std::nullopt
                    : std::optional<std::string>(value));
            setEnvironment(name, std::nullopt);
        }
    }

    ~EnvironmentGuard()
    {
        for (const auto& [name, value] : originalValues_)
        {
            try
            {
                setEnvironment(name.c_str(), value);
            }
            catch (...)
            {
            }
        }
    }

private:
    std::vector<std::pair<std::string, std::optional<std::string>>> originalValues_;
};

void require(bool condition, const std::string& message)
{
    if (!condition)
    {
        throw std::runtime_error(message);
    }
}

void requireConfigError(const char* name, const char* value)
{
    setEnvironment(name, std::string(value));
    try
    {
        static_cast<void>(voicecalendar::config::BackendConfig::load());
    }
    catch (const voicecalendar::config::ConfigError&)
    {
        setEnvironment(name, std::nullopt);
        return;
    }
    setEnvironment(name, std::nullopt);
    throw std::runtime_error(
        std::string(name) + "=" + value + " should be rejected");
}
} // namespace

int main()
{
    try
    {
        EnvironmentGuard environment;

        const auto defaults = voicecalendar::config::BackendConfig::load();
        require(defaults.host == "127.0.0.1", "Default host is incorrect");
        require(defaults.port == 8080, "Default port is incorrect");
        require(
            defaults.reminderScanInterval == std::chrono::seconds(30),
            "Default reminder scan interval is incorrect");
        require(
            defaults.databasePath ==
                std::filesystem::absolute(
                    defaults.backendRoot / "data" / "voicecalendar.db").lexically_normal(),
            "Default database path is incorrect");

        setEnvironment("VOICECALENDAR_HOST", std::string("0.0.0.0"));
        setEnvironment("VOICECALENDAR_PORT", std::string("18081"));
        setEnvironment("VOICECALENDAR_DB_PATH", std::string("backend/data/config-test.db"));
        setEnvironment("VOICECALENDAR_REMINDER_SCAN_SECONDS", std::string("7"));
        const auto custom = voicecalendar::config::BackendConfig::load();
        require(custom.host == "0.0.0.0", "Custom host was not applied");
        require(custom.port == 18081, "Custom port was not applied");
        require(
            custom.databasePath == std::filesystem::absolute(
                custom.backendRoot.parent_path() /
                "backend/data/config-test.db").lexically_normal(),
            "Custom database path was not applied");

        const auto originalWorkingDirectory = std::filesystem::current_path();
        const auto alternateWorkingDirectory = std::filesystem::temp_directory_path();
        std::filesystem::current_path(alternateWorkingDirectory);
        const auto fromAlternateWorkingDirectory =
            voicecalendar::config::BackendConfig::load();
        std::filesystem::current_path(originalWorkingDirectory);
        require(
            fromAlternateWorkingDirectory.backendRoot == custom.backendRoot,
            "Backend root changed with the working directory");
        require(
            fromAlternateWorkingDirectory.databasePath == custom.databasePath,
            "Relative custom database path changed with the working directory");
        require(
            custom.reminderScanInterval == std::chrono::seconds(7),
            "Custom reminder scan interval was not applied");

        for (const auto* name : kEnvironmentNames)
        {
            setEnvironment(name, std::nullopt);
        }
        requireConfigError("VOICECALENDAR_PORT", "abc");
        requireConfigError("VOICECALENDAR_PORT", "0");
        requireConfigError("VOICECALENDAR_PORT", "70000");
        requireConfigError("VOICECALENDAR_REMINDER_SCAN_SECONDS", "0");
        requireConfigError("VOICECALENDAR_REMINDER_SCAN_SECONDS", "-1");
        requireConfigError("VOICECALENDAR_REMINDER_SCAN_SECONDS", "abc");

        std::cout << "BackendConfig tests passed\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "BackendConfig tests failed: " << error.what() << '\n';
        return 1;
    }
}
