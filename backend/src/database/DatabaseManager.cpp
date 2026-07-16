#include "database/DatabaseManager.h"

#include <drogon/orm/Exception.h>

#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace voicecalendar::database
{
namespace
{
constexpr auto kDatabasePathEnv = "VOICECALENDAR_DB_PATH";
constexpr auto kDefaultDatabaseFile = "voicecalendar.db";
constexpr auto kCreateEventsMigration = "001_create_events.sql";

std::filesystem::path normalizePath(std::filesystem::path path)
{
    return path.lexically_normal();
}

bool hasBackendCMakeLists(const std::filesystem::path& path)
{
    return std::filesystem::exists(path / "CMakeLists.txt") &&
           path.filename() == "backend";
}

std::string trimSqlStatement(const std::string& statement)
{
    const auto first = statement.find_first_not_of(" \t\r\n");
    if (first == std::string::npos)
    {
        return {};
    }

    const auto last = statement.find_last_not_of(" \t\r\n");
    return statement.substr(first, last - first + 1);
}

std::vector<std::string> splitMigrationStatements(const std::string& sql)
{
    std::vector<std::string> statements;
    std::string current;

    for (const char character : sql)
    {
        if (character == ';')
        {
            auto statement = trimSqlStatement(current);
            if (!statement.empty())
            {
                statements.push_back(std::move(statement));
            }
            current.clear();
            continue;
        }

        current.push_back(character);
    }

    auto statement = trimSqlStatement(current);
    if (!statement.empty())
    {
        statements.push_back(std::move(statement));
    }

    return statements;
}
} // namespace

DatabaseManager DatabaseManager::create()
{
    if (const char* envPath = std::getenv(kDatabasePathEnv);
        envPath != nullptr && std::string(envPath).empty() == false)
    {
        return DatabaseManager{normalizePath(envPath)};
    }

    return DatabaseManager{resolveDefaultDatabasePath()};
}

DatabaseManager& DatabaseManager::instance()
{
    static auto manager = create();
    return manager;
}

DatabaseManager::DatabaseManager(std::filesystem::path databasePath)
    : databasePath_(normalizePath(std::move(databasePath)))
{
}

void DatabaseManager::initialize()
{
    try
    {
        std::filesystem::create_directories(databasePath_.parent_path());

        client_ = createClient();
        runMigrations(client_);
        verifySchema(client_);

        std::cout << "Database ready: " << databasePath_.string() << '\n';
    }
    catch (const drogon::orm::DrogonDbException& error)
    {
        throw std::runtime_error(std::string("SQLite operation failed: ") + error.base().what());
    }
    catch (const std::filesystem::filesystem_error& error)
    {
        throw std::runtime_error(std::string("Database filesystem error: ") + error.what());
    }
}

const std::filesystem::path& DatabaseManager::databasePath() const noexcept
{
    return databasePath_;
}

drogon::orm::DbClientPtr DatabaseManager::client() const
{
    if (!client_)
    {
        throw std::runtime_error("DatabaseManager has not been initialized");
    }

    return client_;
}

std::filesystem::path DatabaseManager::resolveDefaultDatabasePath()
{
    return resolveBackendRoot() / "data" / kDefaultDatabaseFile;
}

std::filesystem::path DatabaseManager::resolveBackendRoot()
{
    auto current = std::filesystem::current_path();

    while (true)
    {
        if (hasBackendCMakeLists(current))
        {
            return current;
        }

        const auto backendCandidate = current / "backend";
        if (hasBackendCMakeLists(backendCandidate))
        {
            return backendCandidate;
        }

        if (current == current.root_path())
        {
            break;
        }

        current = current.parent_path();
    }

    return std::filesystem::current_path() / "backend";
}

std::filesystem::path DatabaseManager::resolveMigrationPath()
{
    return resolveBackendRoot() / "migrations" / kCreateEventsMigration;
}

std::string DatabaseManager::readMigrationSql()
{
    const auto migrationPath = resolveMigrationPath();
    std::ifstream migrationFile(migrationPath);
    if (!migrationFile)
    {
        throw std::runtime_error("Unable to open migration file: " + migrationPath.string());
    }

    std::ostringstream buffer;
    buffer << migrationFile.rdbuf();
    return buffer.str();
}

drogon::orm::DbClientPtr DatabaseManager::createClient() const
{
    return drogon::orm::DbClient::newSqlite3Client(
        "filename=" + databasePath_.generic_string(),
        1);
}

void DatabaseManager::runMigrations(const drogon::orm::DbClientPtr& client) const
{
    for (const auto& statement : splitMigrationStatements(readMigrationSql()))
    {
        client->execSqlSync(statement);
    }
}

void DatabaseManager::verifySchema(const drogon::orm::DbClientPtr& client) const
{
    const auto result = client->execSqlSync(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'events';");

    if (result.empty())
    {
        throw std::runtime_error("SQLite schema verification failed: events table is missing");
    }
}

} // namespace voicecalendar::database
