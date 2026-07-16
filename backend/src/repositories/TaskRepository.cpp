#include "repositories/TaskRepository.h"

#include "database/DatabaseManager.h"

#include <drogon/orm/Field.h>

#include <stdexcept>

namespace voicecalendar::repositories
{
namespace
{
models::Task taskFromRow(const drogon::orm::Row& row)
{
    const auto status = models::taskStatusFromStorageValue(row["status"].as<std::string>());
    const auto priority = models::taskPriorityFromStorageValue(row["priority"].as<std::string>());
    const auto schedulingStatus = models::taskSchedulingStatusFromStorageValue(
        row["scheduling_status"].as<std::string>());
    if (!status || !priority || !schedulingStatus)
    {
        throw std::runtime_error(
            "Database contains an unsupported task status, priority, or scheduling status");
    }

    models::Task task;
    task.id = row["id"].as<std::string>();
    task.title = row["title"].as<std::string>();
    task.status = *status;
    task.priority = *priority;
    if (!row["deadline_date"].isNull())
    {
        task.deadlineDate = row["deadline_date"].as<std::string>();
    }
    if (!row["deadline_time"].isNull())
    {
        task.deadlineTime = row["deadline_time"].as<std::string>();
    }
    if (!row["estimated_duration_minutes"].isNull())
    {
        task.estimatedDurationMinutes = row["estimated_duration_minutes"].as<int>();
    }
    if (!row["category_id"].isNull())
    {
        task.categoryId = row["category_id"].as<std::string>();
    }
    task.schedulingStatus = *schedulingStatus;
    if (!row["scheduled_event_id"].isNull())
    {
        task.scheduledEventId = row["scheduled_event_id"].as<std::string>();
    }
    if (!row["scheduled_at"].isNull())
    {
        task.scheduledAt = row["scheduled_at"].as<std::string>();
    }
    const auto hasCompleteSchedulingRelation =
        task.scheduledEventId.has_value() && task.scheduledAt.has_value();
    if ((task.schedulingStatus == models::TaskSchedulingStatus::Scheduled &&
         !hasCompleteSchedulingRelation) ||
        (task.schedulingStatus == models::TaskSchedulingStatus::Unscheduled &&
         (task.scheduledEventId || task.scheduledAt)))
    {
        throw std::runtime_error("Database contains an inconsistent task scheduling relation");
    }
    task.createdAt = row["created_at"].as<std::string>();
    task.updatedAt = row["updated_at"].as<std::string>();
    return task;
}

constexpr auto kTaskColumns =
    "id, title, status, priority, deadline_date, deadline_time, "
    "estimated_duration_minutes, category_id, scheduling_status, "
    "scheduled_event_id, scheduled_at, created_at, updated_at ";
} // namespace

std::vector<models::Task> TaskRepository::findAll() const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        std::string("SELECT ") + kTaskColumns +
        "FROM tasks ORDER BY "
        "CASE status WHEN 'pending' THEN 0 ELSE 1 END ASC, "
        "CASE WHEN deadline_date IS NULL THEN 1 ELSE 0 END ASC, "
        "deadline_date ASC, COALESCE(deadline_time, '') ASC, created_at ASC, id ASC;");

    std::vector<models::Task> tasks;
    tasks.reserve(result.size());
    for (const auto& row : result)
    {
        tasks.push_back(taskFromRow(row));
    }
    return tasks;
}

std::optional<models::Task> TaskRepository::findById(const std::string& id) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        std::string("SELECT ") + kTaskColumns + "FROM tasks WHERE id = ?;",
        id);

    if (result.empty())
    {
        return std::nullopt;
    }
    return taskFromRow(result.front());
}

models::Task TaskRepository::create(const models::Task& task) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "INSERT INTO tasks (id, title, status, priority, deadline_date, deadline_time, "
        "estimated_duration_minutes, category_id, scheduling_status, "
        "scheduled_event_id, scheduled_at, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
        task.id,
        task.title,
        models::toStorageValue(task.status),
        models::toStorageValue(task.priority),
        task.deadlineDate,
        task.deadlineTime,
        task.estimatedDurationMinutes,
        task.categoryId,
        models::toStorageValue(task.schedulingStatus),
        task.scheduledEventId,
        task.scheduledAt,
        task.createdAt,
        task.updatedAt);

    if (result.affectedRows() != 1)
    {
        throw std::runtime_error("Task insert did not affect exactly one row");
    }
    return task;
}

bool TaskRepository::update(const models::Task& task) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "UPDATE tasks SET title = ?, status = ?, priority = ?, deadline_date = ?, "
        "deadline_time = ?, estimated_duration_minutes = ?, category_id = ?, "
        "updated_at = ? WHERE id = ?;",
        task.title,
        models::toStorageValue(task.status),
        models::toStorageValue(task.priority),
        task.deadlineDate,
        task.deadlineTime,
        task.estimatedDurationMinutes,
        task.categoryId,
        task.updatedAt,
        task.id);
    return result.affectedRows() == 1;
}

bool TaskRepository::linkScheduling(
    const std::string& id,
    const std::string& eventId,
    const std::string& scheduledAt) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "UPDATE tasks SET scheduling_status = 'scheduled', scheduled_event_id = ?, "
        "scheduled_at = ?, updated_at = ? "
        "WHERE id = ? AND scheduling_status = 'unscheduled' "
        "AND EXISTS (SELECT 1 FROM events WHERE id = ?);",
        eventId,
        scheduledAt,
        scheduledAt,
        id,
        eventId);
    return result.affectedRows() == 1;
}

bool TaskRepository::remove(const std::string& id) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "DELETE FROM tasks WHERE id = ?;",
        id);
    return result.affectedRows() == 1;
}

} // namespace voicecalendar::repositories
