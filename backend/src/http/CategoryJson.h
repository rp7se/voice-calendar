#pragma once

#include "models/Category.h"

#include <json/value.h>

#include <optional>
#include <string>

namespace voicecalendar::http
{

struct CategoryParseResult
{
    models::Category category;
    std::string errorMessage;
    bool valid{false};
};

Json::Value categoryToJson(const models::Category& category);

CategoryParseResult parseCategoryInput(
    const Json::Value& json,
    const std::optional<std::string>& expectedId = std::nullopt);

} // namespace voicecalendar::http
