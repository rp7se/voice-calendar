#pragma once

#include "repositories/EventRepository.h"

#include <string>
#include <vector>

namespace voicecalendar::services
{

struct TimeInterval
{
    int startMinutes;
    int endMinutes;
};

class FreeTimeService
{
public:
    std::vector<TimeInterval> findFreeSlots(
        const repositories::EventRepository& repository,
        const std::string& date,
        int queryStart,
        int queryEnd) const;
};

} // namespace voicecalendar::services
