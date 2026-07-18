#include "repositories/ReminderRepository.h"

#include "database/DatabaseManager.h"

#include <drogon/orm/Field.h>

#include <utility>

namespace voicecalendar::repositories
{
namespace
{
models::ReminderDelivery deliveryFromRow(const drogon::orm::Row& row)
{
    models::ReminderDelivery delivery;
    delivery.id = row["id"].as<std::string>();
    delivery.eventId = row["event_id"].as<std::string>();
    delivery.title = row["title"].as<std::string>();
    delivery.date = row["date"].as<std::string>();
    delivery.startTime = row["start_time"].as<std::string>();
    delivery.scheduledFor = row["scheduled_for"].as<std::string>();
    delivery.triggeredAt = row["triggered_at"].as<std::string>();
    delivery.status = models::reminderStatusFromStorageValue(
        row["status"].as<std::string>());
    delivery.createdAt = row["created_at"].as<std::string>();
    return delivery;
}

constexpr auto kDeliverySelect =
    "SELECT deliveries.id, deliveries.event_id, events.title, events.date, "
    "events.start_time, deliveries.scheduled_for, deliveries.triggered_at, "
    "deliveries.status, deliveries.created_at "
    "FROM reminder_deliveries AS deliveries "
    "INNER JOIN events ON events.id = deliveries.event_id ";
} // namespace

std::vector<models::ReminderCandidate> ReminderRepository::findCandidates(
    const std::string& firstDate,
    const std::string& lastDate) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "SELECT id, title, date, start_time, reminder_minutes_before "
        "FROM events "
        "WHERE reminder_enabled = 1 "
        "AND reminder_minutes_before IS NOT NULL "
        "AND date >= ? AND date <= ? "
        "ORDER BY date ASC, start_time ASC, id ASC;",
        firstDate,
        lastDate);

    std::vector<models::ReminderCandidate> candidates;
    candidates.reserve(result.size());
    for (const auto& row : result)
    {
        models::ReminderCandidate candidate;
        candidate.eventId = row["id"].as<std::string>();
        candidate.title = row["title"].as<std::string>();
        candidate.date = row["date"].as<std::string>();
        candidate.startTime = row["start_time"].as<std::string>();
        candidate.reminderMinutesBefore = row["reminder_minutes_before"].as<int>();
        candidates.push_back(std::move(candidate));
    }
    return candidates;
}

bool ReminderRepository::createPending(
    const models::ReminderCandidate& candidate,
    const models::ReminderDelivery& delivery) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "INSERT OR IGNORE INTO reminder_deliveries "
        "(id, event_id, scheduled_for, triggered_at, status, created_at) "
        "SELECT ?, events.id, ?, ?, 'pending', ? FROM events "
        "WHERE events.id = ? AND events.date = ? AND events.start_time = ? "
        "AND events.reminder_enabled = 1 "
        "AND events.reminder_minutes_before = ?;",
        delivery.id,
        delivery.scheduledFor,
        delivery.triggeredAt,
        delivery.createdAt,
        candidate.eventId,
        candidate.date,
        candidate.startTime,
        candidate.reminderMinutesBefore);
    return result.affectedRows() == 1;
}

std::vector<models::ReminderDelivery> ReminderRepository::findPending() const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        std::string(kDeliverySelect) +
        "WHERE deliveries.status = 'pending' "
        "ORDER BY deliveries.triggered_at ASC, deliveries.id ASC;");

    std::vector<models::ReminderDelivery> deliveries;
    deliveries.reserve(result.size());
    for (const auto& row : result)
    {
        deliveries.push_back(deliveryFromRow(row));
    }
    return deliveries;
}

std::optional<models::ReminderDelivery> ReminderRepository::findById(
    const std::string& id) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        std::string(kDeliverySelect) + "WHERE deliveries.id = ?;",
        id);
    if (result.empty())
    {
        return std::nullopt;
    }
    return deliveryFromRow(result.front());
}

bool ReminderRepository::acknowledge(const std::string& id) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "UPDATE reminder_deliveries SET status = 'acknowledged' "
        "WHERE id = ? AND status = 'pending';",
        id);
    return result.affectedRows() == 1;
}

} // namespace voicecalendar::repositories
