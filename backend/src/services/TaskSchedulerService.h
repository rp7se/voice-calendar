#pragma once

#include "models/Scheduling.h"
#include "repositories/EventRepository.h"
#include "services/FreeTimeService.h"

#include <string>
#include <vector>

namespace voicecalendar::services
{

class TaskSchedulerService
{
public:
    models::SchedulingResult createPreview(
        const repositories::EventRepository& repository,
        const FreeTimeService& freeTimeService,
        const std::string& date,
        int queryStart,
        int queryEnd,
        const std::vector<models::SchedulingTask>& tasks) const;

private:
    static int priorityRank(models::SchedulingTaskPriority priority);
    static bool taskComesBefore(
        const models::SchedulingTask* left,
        const models::SchedulingTask* right);
};

} // namespace voicecalendar::services
