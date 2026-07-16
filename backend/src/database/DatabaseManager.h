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
    static DatabaseManager create();

    explicit DatabaseManager(std::filesystem::path databasePath);

    void initialize();

    const std::filesystem::path& databasePath() const noexcept;
    drogon::orm::DbClientPtr client() const;

private:
    std::filesystem::path databasePath_;
    drogon::orm::DbClientPtr client_;

    static std::filesystem::path resolveDefaultDatabasePath();
    static std::filesystem::path resolveBackendRoot();
    static std::vector<std::filesystem::path> resolveMigrationPaths();
    static std::string readMigrationSql(const std::filesystem::path& migrationPath);

    drogon::orm::DbClientPtr createClient() const;
    void runMigrations(const drogon::orm::DbClientPtr& client) const;
    void verifySchema(const drogon::orm::DbClientPtr& client) const;
};

} // namespace voicecalendar::database
