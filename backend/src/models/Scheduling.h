#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <vector>

namespace voicecalendar::models
{

enum class SchedulingTaskStatus
{
    Pending,
    Completed
};

enum class SchedulingTaskPriority
{
    High,
    Medium,
    Low
};

enum class EstimatedDurationState
{
    Missing,
    Invalid,
    Valid
};

struct SchedulingTask
{
    std::string id;
    std::string title;
    SchedulingTaskStatus status{SchedulingTaskStatus::Pending};
    SchedulingTaskPriority priority{SchedulingTaskPriority::Medium};
    std::optional<std::string> deadlineDate;
    std::optional<int> deadlineTimeMinutes;
    int estimatedDurationMinutes{0};
    EstimatedDurationState durationState{EstimatedDurationState::Missing};
    std::size_t inputOrder{0};
};

struct ScheduledTask
{
    std::string taskId;
    std::string title;
    int startMinutes;
    int endMinutes;
};

struct UnscheduledTask
{
    std::string taskId;
    std::string title;
    std::string reason;
};

struct SchedulingResult
{
    std::vector<ScheduledTask> scheduled;
    std::vector<UnscheduledTask> unscheduled;
    int totalTasks{0};
    int skippedCompletedTasks{0};
    int scheduledMinutes{0};
};

} // namespace voicecalendar::models
