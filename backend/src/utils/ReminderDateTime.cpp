#include "utils/ReminderDateTime.h"

#include "utils/DateTimeUtils.h"

#include <ctime>
#include <iomanip>
#include <sstream>

namespace voicecalendar::utils
{
namespace
{
constexpr auto kZeroMinuteTriggerWindow = std::chrono::seconds(90);

std::tm localTime(std::time_t value)
{
    std::tm result{};
#ifdef _WIN32
    localtime_s(&result, &value);
#else
    localtime_r(&value, &result);
#endif
    return result;
}

std::tm utcTime(std::time_t value)
{
    std::tm result{};
#ifdef _WIN32
    gmtime_s(&result, &value);
#else
    gmtime_r(&value, &result);
#endif
    return result;
}

std::string formatTime(
    std::chrono::system_clock::time_point time,
    const char* format,
    bool utc)
{
    const auto value = std::chrono::system_clock::to_time_t(time);
    const auto brokenDown = utc ? utcTime(value) : localTime(value);
    std::ostringstream output;
    output << std::put_time(&brokenDown, format);
    return output.str();
}
} // namespace

std::optional<ReminderTiming> calculateReminderTiming(
    const std::string& date,
    const std::string& startTime,
    int reminderMinutesBefore)
{
    const auto minutes = parseTimeToMinutes(startTime);
    if (!isValidDate(date) || !minutes || reminderMinutesBefore < 0)
    {
        return std::nullopt;
    }

    std::tm local{};
    local.tm_year = std::stoi(date.substr(0, 4)) - 1900;
    local.tm_mon = std::stoi(date.substr(5, 2)) - 1;
    local.tm_mday = std::stoi(date.substr(8, 2));
    local.tm_hour = *minutes / 60;
    local.tm_min = *minutes % 60;
    local.tm_sec = 0;
    local.tm_isdst = -1;

    const auto eventStartValue = std::mktime(&local);
    if (eventStartValue == static_cast<std::time_t>(-1))
    {
        return std::nullopt;
    }

    ReminderTiming timing;
    timing.eventStart = std::chrono::system_clock::from_time_t(eventStartValue);
    timing.scheduledFor = timing.eventStart - std::chrono::minutes(reminderMinutesBefore);
    return timing;
}

bool shouldTriggerReminder(
    const ReminderTiming& timing,
    int reminderMinutesBefore,
    std::chrono::system_clock::time_point now)
{
    if (reminderMinutesBefore == 0)
    {
        return now >= timing.eventStart &&
               now < timing.eventStart + kZeroMinuteTriggerWindow;
    }
    return timing.scheduledFor <= now && now < timing.eventStart;
}

std::string formatLocalDate(std::chrono::system_clock::time_point time)
{
    return formatTime(time, "%Y-%m-%d", false);
}

std::string formatLocalDateTime(std::chrono::system_clock::time_point time)
{
    return formatTime(time, "%Y-%m-%dT%H:%M:%S", false);
}

std::string formatUtcDateTime(std::chrono::system_clock::time_point time)
{
    return formatTime(time, "%Y-%m-%dT%H:%M:%SZ", true);
}

} // namespace voicecalendar::utils
