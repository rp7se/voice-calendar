#pragma once

#include "models/Reminder.h"

#include <optional>
#include <string>
#include <vector>

namespace voicecalendar::repositories
{

class ReminderRepository
{
public:
    std::vector<models::ReminderCandidate> findCandidates(
        const std::string& firstDate,
        const std::string& lastDate) const;

    bool createPending(
        const models::ReminderCandidate& candidate,
        const models::ReminderDelivery& delivery) const;

    std::vector<models::ReminderDelivery> findPending() const;
    std::optional<models::ReminderDelivery> findById(const std::string& id) const;
    bool acknowledge(const std::string& id) const;
};

} // namespace voicecalendar::repositories
