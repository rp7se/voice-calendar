#pragma once

#include <optional>
#include <string>

namespace voicecalendar::models
{

enum class EventType
{
    Schedule,
    Course,
    Work,
    Reminder
};

struct Event
{
    std::string id;
    std::string title;
    std::string description;
    std::string date;
    std::string startTime;
    std::optional<std::string> endTime;
    EventType type{EventType::Schedule};
    std::optional<std::string> categoryId;
    bool reminderEnabled{false};
    std::string createdAt;
    std::string updatedAt;
};

std::string toStorageValue(EventType type);
std::optional<EventType> eventTypeFromStorageValue(const std::string& value);

} // namespace voicecalendar::models
