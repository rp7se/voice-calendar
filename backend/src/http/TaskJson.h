#pragma once

#include "models/Task.h"

#include <json/value.h>

#include <optional>
#include <string>

namespace voicecalendar::http
{

struct TaskParseResult
{
    models::Task task;
    std::string errorMessage;
    bool valid{false};
};

Json::Value taskToJson(const models::Task& task);

TaskParseResult parseTaskInput(
    const Json::Value& json,
    const std::optional<std::string>& expectedId = std::nullopt);

} // namespace voicecalendar::http
