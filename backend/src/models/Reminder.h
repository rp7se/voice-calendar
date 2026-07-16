#pragma once

#include <string>

namespace voicecalendar::models
{

constexpr int kMaximumReminderMinutesBefore = 10080;

enum class ReminderStatus
{
    Pending,
    Acknowledged
};

struct ReminderCandidate
{
    std::string eventId;
    std::string date;
    std::string startTime;
    int reminderMinutesBefore{0};
};

struct ReminderDelivery
{
    std::string id;
    std::string eventId;
    std::string title;
    std::string date;
    std::string startTime;
    std::string scheduledFor;
    std::string triggeredAt;
    ReminderStatus status{ReminderStatus::Pending};
    std::string createdAt;
};

std::string toStorageValue(ReminderStatus status);
ReminderStatus reminderStatusFromStorageValue(const std::string& value);

} // namespace voicecalendar::models
