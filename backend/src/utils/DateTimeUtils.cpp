#include "utils/DateTimeUtils.h"

#include <cctype>
#include <iomanip>
#include <sstream>

namespace voicecalendar::utils
{
namespace
{
bool hasExactDigits(const std::string& value, std::size_t offset, std::size_t count)
{
    if (offset + count > value.size())
    {
        return false;
    }
    for (std::size_t index = offset; index < offset + count; ++index)
    {
        if (std::isdigit(static_cast<unsigned char>(value[index])) == 0)
        {
            return false;
        }
    }
    return true;
}

int parseNumber(const std::string& value, std::size_t offset, std::size_t count)
{
    return std::stoi(value.substr(offset, count));
}

bool isLeapYear(int year)
{
    return year % 400 == 0 || (year % 4 == 0 && year % 100 != 0);
}
} // namespace

bool isValidDate(const std::string& value)
{
    if (value.size() != 10 || value[4] != '-' || value[7] != '-' ||
        !hasExactDigits(value, 0, 4) || !hasExactDigits(value, 5, 2) ||
        !hasExactDigits(value, 8, 2))
    {
        return false;
    }

    const auto year = parseNumber(value, 0, 4);
    const auto month = parseNumber(value, 5, 2);
    const auto day = parseNumber(value, 8, 2);
    if (year == 0 || month < 1 || month > 12)
    {
        return false;
    }

    constexpr int daysPerMonth[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    auto maxDay = daysPerMonth[month - 1];
    if (month == 2 && isLeapYear(year))
    {
        maxDay = 29;
    }
    return day >= 1 && day <= maxDay;
}

std::optional<int> parseTimeToMinutes(const std::string& value)
{
    if (value.size() != 5 || value[2] != ':' ||
        !hasExactDigits(value, 0, 2) || !hasExactDigits(value, 3, 2))
    {
        return std::nullopt;
    }

    const auto hour = parseNumber(value, 0, 2);
    const auto minute = parseNumber(value, 3, 2);
    if (hour > 23 || minute > 59)
    {
        return std::nullopt;
    }
    return hour * 60 + minute;
}

std::string formatMinutesAsTime(int minutes)
{
    std::ostringstream output;
    output << std::setw(2) << std::setfill('0') << minutes / 60
           << ':' << std::setw(2) << std::setfill('0') << minutes % 60;
    return output.str();
}

} // namespace voicecalendar::utils
