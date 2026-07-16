#pragma once

#include "models/Event.h"

#include <json/value.h>

#include <optional>
#include <string>

namespace voicecalendar::http
{

struct EventParseResult
{
    models::Event event;
    std::string errorMessage;
    bool valid{false};
};

Json::Value eventToJson(const models::Event& event);

EventParseResult parseEventInput(
    const Json::Value& json,
    const std::optional<std::string>& expectedId = std::nullopt);

} // namespace voicecalendar::http
