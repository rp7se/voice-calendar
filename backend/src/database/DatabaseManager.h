#pragma once

#include <drogon/orm/DbClient.h>

#include <filesystem>
#include <vector>

namespace voicecalendar::database
{

class DatabaseManager
{
public:
    static DatabaseManager& instance();

    void initialize(
        std::filesystem::path databasePath,
        std::filesystem::path backendRoot);

    const std::filesystem::path& databasePath() const noexcept;
    drogon::orm::DbClientPtr client() const;

private:
    DatabaseManager() = default;

    std::filesystem::path databasePath_;
    std::filesystem::path backendRoot_;
    drogon::orm::DbClientPtr client_;

    std::vector<std::filesystem::path> resolveMigrationPaths() const;
    static std::string readMigrationSql(const std::filesystem::path& migrationPath);

    drogon::orm::DbClientPtr createClient() const;
    void runMigrations(const drogon::orm::DbClientPtr& client) const;
    void verifySchema(const drogon::orm::DbClientPtr& client) const;
};

} // namespace voicecalendar::database
