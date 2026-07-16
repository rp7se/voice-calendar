#include "services/EventConflictService.h"

#include <cctype>

namespace voicecalendar::services
{

std::optional<int> EventConflictService::parseMinutes(const std::string& value)
{
    if (value.size() != 5 || value[2] != ':' ||
        std::isdigit(static_cast<unsigned char>(value[0])) == 0 ||
        std::isdigit(static_cast<unsigned char>(value[1])) == 0 ||
        std::isdigit(static_cast<unsigned char>(value[3])) == 0 ||
        std::isdigit(static_cast<unsigned char>(value[4])) == 0)
    {
        return std::nullopt;
    }

    const auto hour = (value[0] - '0') * 10 + (value[1] - '0');
    const auto minute = (value[3] - '0') * 10 + (value[4] - '0');
    if (hour > 23 || minute > 59)
    {
        return std::nullopt;
    }
    return hour * 60 + minute;
}

bool EventConflictService::overlaps(
    int newStart,
    int newEnd,
    int existingStart,
    int existingEnd)
{
    return newStart < existingEnd && existingStart < newEnd;
}

ConflictCheckResult EventConflictService::findConflicts(
    const repositories::EventRepository& repository,
    const models::Event& event,
    const std::optional<std::string>& excludeEventId) const
{
    ConflictCheckResult result;
    if (!event.endTime)
    {
        return result;
    }

    const auto newStart = parseMinutes(event.startTime);
    const auto newEnd = parseMinutes(*event.endTime);
    if (!newStart || !newEnd || *newStart >= *newEnd)
    {
        result.validTimeRange = false;
        return result;
    }

    for (const auto& existing : repository.findPotentialConflicts(
             event.date,
             excludeEventId))
    {
        if (!existing.endTime)
        {
            continue;
        }

        const auto existingStart = parseMinutes(existing.startTime);
        const auto existingEnd = parseMinutes(*existing.endTime);
        if (!existingStart || !existingEnd || *existingStart >= *existingEnd)
        {
            continue;
        }

        if (overlaps(*newStart, *newEnd, *existingStart, *existingEnd))
        {
            result.conflicts.push_back(existing);
        }
    }
    return result;
}

} // namespace voicecalendar::services
