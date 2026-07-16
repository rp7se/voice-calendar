#include "models/Event.h"

namespace voicecalendar::models
{

std::string toStorageValue(EventType type)
{
    switch (type)
    {
    case EventType::Schedule:
        return "schedule";
    case EventType::Course:
        return "course";
    case EventType::Work:
        return "work";
    case EventType::Reminder:
        return "reminder";
    }

    return "schedule";
}

std::optional<EventType> eventTypeFromStorageValue(const std::string& value)
{
    if (value == "schedule")
    {
        return EventType::Schedule;
    }
    if (value == "course")
    {
        return EventType::Course;
    }
    if (value == "work")
    {
        return EventType::Work;
    }
    if (value == "reminder")
    {
        return EventType::Reminder;
    }

    return std::nullopt;
}

} // namespace voicecalendar::models
