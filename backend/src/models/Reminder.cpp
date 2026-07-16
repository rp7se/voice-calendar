#include "models/Reminder.h"

#include <stdexcept>

namespace voicecalendar::models
{

std::string toStorageValue(ReminderStatus status)
{
    return status == ReminderStatus::Acknowledged ? "acknowledged" : "pending";
}

ReminderStatus reminderStatusFromStorageValue(const std::string& value)
{
    if (value == "pending")
    {
        return ReminderStatus::Pending;
    }
    if (value == "acknowledged")
    {
        return ReminderStatus::Acknowledged;
    }
    throw std::runtime_error("Database contains an unsupported reminder status");
}

} // namespace voicecalendar::models
