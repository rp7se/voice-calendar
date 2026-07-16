#pragma once

#include <drogon/orm/DbClient.h>

#include <filesystem>

namespace voicecalendar::database
{

class DatabaseManager
{
public:
    static DatabaseManager create();

    explicit DatabaseManager(std::filesystem::path databasePath);

    void initialize() const;

    const std::filesystem::path& databasePath() const noexcept;

private:
    std::filesystem::path databasePath_;

    static std::filesystem::path resolveDefaultDatabasePath();
    static std::filesystem::path resolveBackendRoot();
    static std::filesystem::path resolveMigrationPath();
    static std::string readMigrationSql();

    drogon::orm::DbClientPtr createClient() const;
    void runMigrations(const drogon::orm::DbClientPtr& client) const;
    void verifySchema(const drogon::orm::DbClientPtr& client) const;
};

} // namespace voicecalendar::database
