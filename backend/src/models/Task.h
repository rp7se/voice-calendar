#pragma once

#include <optional>
#include <string>

namespace voicecalendar::models
{

enum class TaskStatus
{
    Pending,
    Completed
};

enum class TaskPriority
{
    High,
    Medium,
    Low
};

enum class TaskSchedulingStatus
{
    Unscheduled,
    Scheduled
};

struct Task
{
    std::string id;
    std::string title;
    TaskStatus status{TaskStatus::Pending};
    TaskPriority priority{TaskPriority::Medium};
    std::optional<std::string> deadlineDate;
    std::optional<std::string> deadlineTime;
    std::optional<int> estimatedDurationMinutes;
    std::optional<std::string> categoryId;
    TaskSchedulingStatus schedulingStatus{TaskSchedulingStatus::Unscheduled};
    std::optional<std::string> scheduledEventId;
    std::optional<std::string> scheduledAt;
    std::string createdAt;
    std::string updatedAt;
};

std::string toStorageValue(TaskStatus status);
std::optional<TaskStatus> taskStatusFromStorageValue(const std::string& value);
std::string toStorageValue(TaskPriority priority);
std::optional<TaskPriority> taskPriorityFromStorageValue(const std::string& value);
std::string toStorageValue(TaskSchedulingStatus status);
std::optional<TaskSchedulingStatus> taskSchedulingStatusFromStorageValue(
    const std::string& value);

} // namespace voicecalendar::models
