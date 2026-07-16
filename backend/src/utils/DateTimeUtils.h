#pragma once

#include <optional>
#include <string>

namespace voicecalendar::utils
{

bool isValidDate(const std::string& value);
std::optional<int> parseTimeToMinutes(const std::string& value);
std::string formatMinutesAsTime(int minutes);

} // namespace voicecalendar::utils
