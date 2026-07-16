#pragma once

#include <chrono>
#include <optional>
#include <string>

namespace voicecalendar::utils
{

struct ReminderTiming
{
    std::chrono::system_clock::time_point eventStart;
    std::chrono::system_clock::time_point scheduledFor;
};

std::optional<ReminderTiming> calculateReminderTiming(
    const std::string& date,
    const std::string& startTime,
    int reminderMinutesBefore);

bool shouldTriggerReminder(
    const ReminderTiming& timing,
    int reminderMinutesBefore,
    std::chrono::system_clock::time_point now);

std::string formatLocalDate(std::chrono::system_clock::time_point time);
std::string formatLocalDateTime(std::chrono::system_clock::time_point time);
std::string formatUtcDateTime(std::chrono::system_clock::time_point time);

} // namespace voicecalendar::utils
