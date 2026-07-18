#pragma once

#include <chrono>
#include <cstdint>
#include <filesystem>
#include <stdexcept>
#include <string>

namespace voicecalendar::config
{

class ConfigError : public std::runtime_error
{
public:
    using std::runtime_error::runtime_error;
};

struct BackendConfig
{
    std::string host;
    std::uint16_t port{0};
    std::filesystem::path databasePath;
    std::filesystem::path backendRoot;
    std::chrono::seconds reminderScanInterval{0};

    static BackendConfig load();
};

} // namespace voicecalendar::config
