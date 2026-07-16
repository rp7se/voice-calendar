#include "services/TaskSchedulerService.h"

#include <algorithm>

namespace voicecalendar::services
{

int TaskSchedulerService::priorityRank(models::SchedulingTaskPriority priority)
{
    switch (priority)
    {
    case models::SchedulingTaskPriority::High:
        return 0;
    case models::SchedulingTaskPriority::Medium:
        return 1;
    case models::SchedulingTaskPriority::Low:
        return 2;
    }
    return 2;
}

bool TaskSchedulerService::taskComesBefore(
    const models::SchedulingTask* left,
    const models::SchedulingTask* right)
{
    if (left->deadlineDate.has_value() != right->deadlineDate.has_value())
    {
        return left->deadlineDate.has_value();
    }
    if (left->deadlineDate && right->deadlineDate)
    {
        if (*left->deadlineDate != *right->deadlineDate)
        {
            return *left->deadlineDate < *right->deadlineDate;
        }

        const auto leftDeadlineTime = left->deadlineTimeMinutes.value_or(24 * 60);
        const auto rightDeadlineTime = right->deadlineTimeMinutes.value_or(24 * 60);
        if (leftDeadlineTime != rightDeadlineTime)
        {
            return leftDeadlineTime < rightDeadlineTime;
        }
    }

    const auto priorityDifference = priorityRank(left->priority) - priorityRank(right->priority);
    if (priorityDifference != 0)
    {
        return priorityDifference < 0;
    }
    if (left->estimatedDurationMinutes != right->estimatedDurationMinutes)
    {
        return left->estimatedDurationMinutes > right->estimatedDurationMinutes;
    }
    return left->inputOrder < right->inputOrder;
}

models::SchedulingResult TaskSchedulerService::createPreview(
    const repositories::EventRepository& repository,
    const FreeTimeService& freeTimeService,
    const std::string& date,
    int queryStart,
    int queryEnd,
    const std::vector<models::SchedulingTask>& tasks) const
{
    models::SchedulingResult result;
    result.totalTasks = static_cast<int>(tasks.size());

    auto freeSlots = freeTimeService.findFreeSlots(
        repository,
        date,
        queryStart,
        queryEnd);
    std::vector<const models::SchedulingTask*> schedulableTasks;
    schedulableTasks.reserve(tasks.size());

    for (const auto& task : tasks)
    {
        if (task.status == models::SchedulingTaskStatus::Completed)
        {
            result.skippedCompletedTasks += 1;
            continue;
        }
        if (task.durationState == models::EstimatedDurationState::Missing)
        {
            result.unscheduled.push_back(
                {task.id, task.title, "missing_estimated_duration"});
            continue;
        }
        if (task.durationState == models::EstimatedDurationState::Invalid)
        {
            result.unscheduled.push_back(
                {task.id, task.title, "invalid_estimated_duration"});
            continue;
        }
        schedulableTasks.push_back(&task);
    }

    std::stable_sort(
        schedulableTasks.begin(),
        schedulableTasks.end(),
        taskComesBefore);

    for (const auto* task : schedulableTasks)
    {
        const auto slot = std::find_if(
            freeSlots.begin(),
            freeSlots.end(),
            [task](const TimeInterval& candidate) {
                return candidate.endMinutes - candidate.startMinutes >=
                       task->estimatedDurationMinutes;
            });
        if (slot == freeSlots.end())
        {
            result.unscheduled.push_back(
                {task->id, task->title, "no_sufficient_contiguous_slot"});
            continue;
        }

        const auto taskStart = slot->startMinutes;
        const auto taskEnd = taskStart + task->estimatedDurationMinutes;
        result.scheduled.push_back(
            {task->id, task->title, taskStart, taskEnd});
        result.scheduledMinutes += task->estimatedDurationMinutes;

        slot->startMinutes = taskEnd;
        if (slot->startMinutes == slot->endMinutes)
        {
            freeSlots.erase(slot);
        }
    }
    return result;
}

} // namespace voicecalendar::services
