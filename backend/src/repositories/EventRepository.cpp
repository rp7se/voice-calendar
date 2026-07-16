#include "repositories/EventRepository.h"

#include "database/DatabaseManager.h"

#include <drogon/orm/DbClient.h>
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
    if (!row["reminder_minutes_before"].isNull())
    {
        event.reminderMinutesBefore = row["reminder_minutes_before"].as<int>();
    }
    event.createdAt = row["created_at"].as<std::string>();
    event.updatedAt = row["updated_at"].as<std::string>();
    return event;
}
} // namespace

std::vector<models::Event> EventRepository::findAll() const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "SELECT id, title, description, date, start_time, end_time, type, "
        "category_id, reminder_enabled, reminder_minutes_before, created_at, updated_at "
        "FROM events ORDER BY date ASC, start_time ASC, id ASC;");

    std::vector<models::Event> events;
    events.reserve(result.size());
    for (const auto& row : result)
    {
        events.push_back(eventFromRow(row));
    }
    return events;
}

std::vector<models::Event> EventRepository::findByDate(const std::string& date) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "SELECT id, title, description, date, start_time, end_time, type, "
        "category_id, reminder_enabled, reminder_minutes_before, created_at, updated_at "
        "FROM events WHERE date = ? ORDER BY start_time ASC, id ASC;",
        date);

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
        "category_id, reminder_enabled, reminder_minutes_before, created_at, updated_at "
        "FROM events WHERE id = ?;",
        id);

    if (result.empty())
    {
        return std::nullopt;
    }
    return eventFromRow(result.front());
}

std::vector<models::Event> EventRepository::findPotentialConflicts(
    const std::string& date,
    const std::optional<std::string>& excludeEventId) const
{
    drogon::orm::Result result;
    if (excludeEventId)
    {
        result = database::DatabaseManager::instance().client()->execSqlSync(
            "SELECT id, title, description, date, start_time, end_time, type, "
            "category_id, reminder_enabled, reminder_minutes_before, created_at, updated_at "
            "FROM events WHERE date = ? AND end_time IS NOT NULL AND id <> ? "
            "ORDER BY start_time ASC, id ASC;",
            date,
            *excludeEventId);
    }
    else
    {
        result = database::DatabaseManager::instance().client()->execSqlSync(
            "SELECT id, title, description, date, start_time, end_time, type, "
            "category_id, reminder_enabled, reminder_minutes_before, created_at, updated_at "
            "FROM events WHERE date = ? AND end_time IS NOT NULL "
            "ORDER BY start_time ASC, id ASC;",
            date);
    }

    std::vector<models::Event> events;
    events.reserve(result.size());
    for (const auto& row : result)
    {
        events.push_back(eventFromRow(row));
    }
    return events;
}

models::Event EventRepository::create(const models::Event& event) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "INSERT INTO events (id, title, description, date, start_time, end_time, "
        "type, category_id, reminder_enabled, reminder_minutes_before, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
        event.id,
        event.title,
        event.description,
        event.date,
        event.startTime,
        event.endTime,
        models::toStorageValue(event.type),
        event.categoryId,
        event.reminderEnabled,
        event.reminderMinutesBefore,
        event.createdAt,
        event.updatedAt);

    if (result.affectedRows() != 1)
    {
        throw std::runtime_error("Event insert did not affect exactly one row");
    }
    return event;
}

bool EventRepository::update(const models::Event& event, bool clearPendingReminders) const
{
    auto transaction = database::DatabaseManager::instance().client()->newTransaction(
        drogon::orm::TransactionType::Immediate);
    if (clearPendingReminders)
    {
        transaction->execSqlSync(
            "DELETE FROM reminder_deliveries WHERE event_id = ? AND status = 'pending';",
            event.id);
    }

    const auto result = transaction->execSqlSync(
        "UPDATE events SET title = ?, description = ?, date = ?, start_time = ?, "
        "end_time = ?, type = ?, category_id = ?, reminder_enabled = ?, "
        "reminder_minutes_before = ?, updated_at = ? WHERE id = ?;",
        event.title,
        event.description,
        event.date,
        event.startTime,
        event.endTime,
        models::toStorageValue(event.type),
        event.categoryId,
        event.reminderEnabled,
        event.reminderMinutesBefore,
        event.updatedAt,
        event.id);
    if (result.affectedRows() != 1)
    {
        transaction->rollback();
        return false;
    }
    transaction.reset();
    return true;
}

bool EventRepository::remove(const std::string& id) const
{
    auto transaction = database::DatabaseManager::instance().client()->newTransaction(
        drogon::orm::TransactionType::Immediate);

    transaction->execSqlSync(
        "DELETE FROM reminder_deliveries WHERE event_id = ?;",
        id);
    transaction->execSqlSync(
        "UPDATE tasks SET scheduling_status = 'unscheduled', "
        "scheduled_event_id = NULL, scheduled_at = NULL, "
        "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') "
        "WHERE scheduled_event_id = ?;",
        id);
    const auto result = transaction->execSqlSync(
        "DELETE FROM events WHERE id = ?;",
        id);
    if (result.affectedRows() != 1)
    {
        transaction->rollback();
        return false;
    }

    transaction.reset();
    return true;
}

} // namespace voicecalendar::repositories
