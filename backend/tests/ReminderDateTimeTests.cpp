#include "utils/ReminderDateTime.h"

#include <chrono>
#include <iostream>

namespace
{
bool expect(bool condition, const char* message)
{
    if (!condition)
    {
        std::cerr << "FAIL: " << message << '\n';
    }
    return condition;
}
} // namespace

int main()
{
    bool passed = true;

    const auto crossMidnight = voicecalendar::utils::calculateReminderTiming(
        "2026-07-21",
        "00:05",
        10);
    passed &= expect(crossMidnight.has_value(), "cross-midnight timing parses");
    if (crossMidnight)
    {
        passed &= expect(
            voicecalendar::utils::formatLocalDateTime(crossMidnight->scheduledFor) ==
                "2026-07-20T23:55:00",
            "cross-midnight reminder is scheduled on the previous day");
    }

    const auto missed = voicecalendar::utils::calculateReminderTiming(
        "2026-07-20",
        "14:00",
        10);
    passed &= expect(missed.has_value(), "missed-reminder timing parses");
    if (missed)
    {
        passed &= expect(
            voicecalendar::utils::shouldTriggerReminder(
                *missed,
                10,
                missed->scheduledFor + std::chrono::minutes(5)),
            "missed reminder triggers while Event has not started");
        passed &= expect(
            !voicecalendar::utils::shouldTriggerReminder(
                *missed,
                10,
                missed->eventStart),
            "past Event does not receive a late reminder");
    }

    const auto atStart = voicecalendar::utils::calculateReminderTiming(
        "2026-07-20",
        "14:00",
        0);
    passed &= expect(atStart.has_value(), "zero-minute timing parses");
    if (atStart)
    {
        passed &= expect(
            voicecalendar::utils::shouldTriggerReminder(
                *atStart,
                0,
                atStart->eventStart + std::chrono::seconds(30)),
            "zero-minute reminder triggers inside the short window");
        passed &= expect(
            !voicecalendar::utils::shouldTriggerReminder(
                *atStart,
                0,
                atStart->eventStart + std::chrono::seconds(90)),
            "zero-minute reminder expires after the short window");
    }

    if (!passed)
    {
        return 1;
    }
    std::cout << "PASS Reminder local-time, missed, past, and zero-minute policy tests\n";
    return 0;
}
