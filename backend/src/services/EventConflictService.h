#pragma once

#include "models/Event.h"
#include "repositories/EventRepository.h"

#include <optional>
#include <string>
#include <vector>

namespace voicecalendar::services
{

struct ConflictCheckResult
{
    std::vector<models::Event> conflicts;
    bool validTimeRange{true};
};

class EventConflictService
{
public:
    ConflictCheckResult findConflicts(
        const repositories::EventRepository& repository,
        const models::Event& event,
        const std::optional<std::string>& excludeEventId = std::nullopt) const;

private:
    static std::optional<int> parseMinutes(const std::string& value);
    static bool overlaps(
        int newStart,
        int newEnd,
        int existingStart,
        int existingEnd);
};

} // namespace voicecalendar::services
