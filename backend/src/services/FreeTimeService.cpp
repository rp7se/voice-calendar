#include "services/FreeTimeService.h"

#include "utils/DateTimeUtils.h"

#include <algorithm>

namespace voicecalendar::services
{

std::vector<TimeInterval> FreeTimeService::findFreeSlots(
    const repositories::EventRepository& repository,
    const std::string& date,
    int queryStart,
    int queryEnd) const
{
    std::vector<TimeInterval> busyIntervals;
    for (const auto& event : repository.findByDate(date))
    {
        if (!event.endTime)
        {
            continue;
        }

        const auto eventStart = utils::parseTimeToMinutes(event.startTime);
        const auto eventEnd = utils::parseTimeToMinutes(*event.endTime);
        if (!eventStart || !eventEnd || *eventStart >= *eventEnd)
        {
            // Historical rows with incomplete or invalid ranges do not occupy time.
            continue;
        }

        const auto clippedStart = std::max(*eventStart, queryStart);
        const auto clippedEnd = std::min(*eventEnd, queryEnd);
        if (clippedStart < clippedEnd)
        {
            busyIntervals.push_back({clippedStart, clippedEnd});
        }
    }

    std::sort(
        busyIntervals.begin(),
        busyIntervals.end(),
        [](const TimeInterval& left, const TimeInterval& right) {
            if (left.startMinutes == right.startMinutes)
            {
                return left.endMinutes < right.endMinutes;
            }
            return left.startMinutes < right.startMinutes;
        });

    std::vector<TimeInterval> mergedBusyIntervals;
    for (const auto& interval : busyIntervals)
    {
        if (mergedBusyIntervals.empty() ||
            interval.startMinutes > mergedBusyIntervals.back().endMinutes)
        {
            mergedBusyIntervals.push_back(interval);
            continue;
        }
        mergedBusyIntervals.back().endMinutes = std::max(
            mergedBusyIntervals.back().endMinutes,
            interval.endMinutes);
    }

    std::vector<TimeInterval> freeSlots;
    auto cursor = queryStart;
    for (const auto& busy : mergedBusyIntervals)
    {
        if (cursor < busy.startMinutes)
        {
            freeSlots.push_back({cursor, busy.startMinutes});
        }
        cursor = std::max(cursor, busy.endMinutes);
    }
    if (cursor < queryEnd)
    {
        freeSlots.push_back({cursor, queryEnd});
    }
    return freeSlots;
}

} // namespace voicecalendar::services
