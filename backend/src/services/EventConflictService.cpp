#include "services/EventConflictService.h"

#include "utils/DateTimeUtils.h"

namespace voicecalendar::services
{

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

    const auto newStart = utils::parseTimeToMinutes(event.startTime);
    const auto newEnd = utils::parseTimeToMinutes(*event.endTime);
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

        const auto existingStart = utils::parseTimeToMinutes(existing.startTime);
        const auto existingEnd = utils::parseTimeToMinutes(*existing.endTime);
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
