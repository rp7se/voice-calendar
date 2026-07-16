#include "repositories/EventRepository.h"

#include "database/DatabaseManager.h"

#include <drogon/orm/Field.h>

#include <stdexcept>

namespace voicecalendar::repositories
{
namespace
{
models::Event eventFromRow(const drogon::orm::Row& row)
{
    const auto eventType = models::eventTypeFromStorageValue(
        row["type"].as<std::string>());
    if (!eventType)
    {
        throw std::runtime_error("Database contains an unsupported event type");
    }

    models::Event event;
    event.id = row["id"].as<std::string>();
    event.title = row["title"].as<std::string>();
    event.description = row["description"].as<std::string>();
    event.date = row["date"].as<std::string>();
    event.startTime = row["start_time"].as<std::string>();
    if (!row["end_time"].isNull())
    {
        event.endTime = row["end_time"].as<std::string>();
    }
    event.type = *eventType;
    if (!row["category_id"].isNull())
    {
        event.categoryId = row["category_id"].as<std::string>();
    }
    event.reminderEnabled = row["reminder_enabled"].as<int>() == 1;
    event.createdAt = row["created_at"].as<std::string>();
    event.updatedAt = row["updated_at"].as<std::string>();
    return event;
}
} // namespace

std::vector<models::Event> EventRepository::findAll() const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "SELECT id, title, description, date, start_time, end_time, type, "
        "category_id, reminder_enabled, created_at, updated_at "
        "FROM events ORDER BY date ASC, start_time ASC, id ASC;");

    std::vector<models::Event> events;
    events.reserve(result.size());
    for (const auto& row : result)
    {
        events.push_back(eventFromRow(row));
    }
    return events;
}

std::optional<models::Event> EventRepository::findById(const std::string& id) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "SELECT id, title, description, date, start_time, end_time, type, "
        "category_id, reminder_enabled, created_at, updated_at "
        "FROM events WHERE id = ?;",
        id);

    if (result.empty())
    {
        return std::nullopt;
    }
    return eventFromRow(result.front());
}

models::Event EventRepository::create(const models::Event& event) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "INSERT INTO events (id, title, description, date, start_time, end_time, "
        "type, category_id, reminder_enabled, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
        event.id,
        event.title,
        event.description,
        event.date,
        event.startTime,
        event.endTime,
        models::toStorageValue(event.type),
        event.categoryId,
        event.reminderEnabled,
        event.createdAt,
        event.updatedAt);

    if (result.affectedRows() != 1)
    {
        throw std::runtime_error("Event insert did not affect exactly one row");
    }
    return event;
}

bool EventRepository::update(const models::Event& event) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "UPDATE events SET title = ?, description = ?, date = ?, start_time = ?, "
        "end_time = ?, type = ?, category_id = ?, reminder_enabled = ?, "
        "updated_at = ? WHERE id = ?;",
        event.title,
        event.description,
        event.date,
        event.startTime,
        event.endTime,
        models::toStorageValue(event.type),
        event.categoryId,
        event.reminderEnabled,
        event.updatedAt,
        event.id);

    return result.affectedRows() == 1;
}

bool EventRepository::remove(const std::string& id) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "DELETE FROM events WHERE id = ?;",
        id);
    return result.affectedRows() == 1;
}

} // namespace voicecalendar::repositories
