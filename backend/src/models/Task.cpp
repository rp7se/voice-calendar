#include "models/Task.h"

namespace voicecalendar::models
{

std::string toStorageValue(TaskStatus status)
{
    return status == TaskStatus::Completed ? "completed" : "pending";
}

std::optional<TaskStatus> taskStatusFromStorageValue(const std::string& value)
{
    if (value == "pending")
    {
        return TaskStatus::Pending;
    }
    if (value == "completed")
    {
        return TaskStatus::Completed;
    }
    return std::nullopt;
}

std::string toStorageValue(TaskPriority priority)
{
    switch (priority)
    {
    case TaskPriority::High:
        return "high";
    case TaskPriority::Medium:
        return "medium";
    case TaskPriority::Low:
        return "low";
    }
    return "medium";
}

std::optional<TaskPriority> taskPriorityFromStorageValue(const std::string& value)
{
    if (value == "high")
    {
        return TaskPriority::High;
    }
    if (value == "medium")
    {
        return TaskPriority::Medium;
    }
    if (value == "low")
    {
        return TaskPriority::Low;
    }
    return std::nullopt;
}

} // namespace voicecalendar::models
