#include "http/TaskJson.h"

#include "utils/DateTimeUtils.h"

#include <algorithm>
#include <cctype>

namespace voicecalendar::http
{
namespace
{
TaskParseResult invalid(std::string message)
{
    TaskParseResult result;
    result.errorMessage = std::move(message);
    return result;
}

std::string trim(std::string value)
{
    const auto isNotSpace = [](unsigned char character) {
        return std::isspace(character) == 0;
    };
    const auto first = std::find_if(value.begin(), value.end(), isNotSpace);
    const auto last = std::find_if(value.rbegin(), value.rend(), isNotSpace).base();
    if (first >= last)
    {
        return {};
    }
    return std::string(first, last);
}
} // namespace

Json::Value taskToJson(const models::Task& task)
{
    Json::Value json(Json::objectValue);
    json["id"] = task.id;
    json["title"] = task.title;
    json["status"] = models::toStorageValue(task.status);
    json["priority"] = models::toStorageValue(task.priority);
    if (task.deadlineDate)
    {
        json["deadlineDate"] = *task.deadlineDate;
    }
    if (task.deadlineTime)
    {
        json["deadlineTime"] = *task.deadlineTime;
    }
    if (task.estimatedDurationMinutes)
    {
        json["estimatedDurationMinutes"] = *task.estimatedDurationMinutes;
    }
    if (task.categoryId)
    {
        json["categoryId"] = *task.categoryId;
    }
    json["schedulingStatus"] = models::toStorageValue(task.schedulingStatus);
    json["scheduledEventId"] = task.scheduledEventId
        ? Json::Value(*task.scheduledEventId)
        : Json::Value(Json::nullValue);
    json["scheduledAt"] = task.scheduledAt
        ? Json::Value(*task.scheduledAt)
        : Json::Value(Json::nullValue);
    json["createdAt"] = task.createdAt;
    json["updatedAt"] = task.updatedAt;
    return json;
}

TaskParseResult parseTaskInput(
    const Json::Value& json,
    const std::optional<std::string>& expectedId)
{
    models::Task task;

    if (json.isMember("id"))
    {
        if (!json["id"].isString() || trim(json["id"].asString()).empty())
        {
            return invalid("id must be a non-empty string");
        }
        task.id = json["id"].asString();
        if (expectedId && task.id != *expectedId)
        {
            return invalid("id must match the request path");
        }
    }
    else if (expectedId)
    {
        task.id = *expectedId;
    }

    if (!json.isMember("title") || !json["title"].isString())
    {
        return invalid("title is required and must be a string");
    }
    task.title = trim(json["title"].asString());
    if (task.title.empty())
    {
        return invalid("title must not be empty");
    }

    if (!json.isMember("status") || !json["status"].isString())
    {
        return invalid("status is required and must be a string");
    }
    const auto status = models::taskStatusFromStorageValue(json["status"].asString());
    if (!status)
    {
        return invalid("status must be pending or completed");
    }
    task.status = *status;

    if (!json.isMember("priority") || !json["priority"].isString())
    {
        return invalid("priority is required and must be a string");
    }
    const auto priority = models::taskPriorityFromStorageValue(json["priority"].asString());
    if (!priority)
    {
        return invalid("priority must be high, medium, or low");
    }
    task.priority = *priority;

    if (json.isMember("deadlineDate") && !json["deadlineDate"].isNull())
    {
        if (!json["deadlineDate"].isString() ||
            !utils::isValidDate(json["deadlineDate"].asString()))
        {
            return invalid("deadlineDate must be null or a valid YYYY-MM-DD value");
        }
        task.deadlineDate = json["deadlineDate"].asString();
    }

    if (json.isMember("deadlineTime") && !json["deadlineTime"].isNull())
    {
        if (!task.deadlineDate)
        {
            return invalid("deadlineTime requires deadlineDate");
        }
        if (!json["deadlineTime"].isString() ||
            !utils::parseTimeToMinutes(json["deadlineTime"].asString()))
        {
            return invalid("deadlineTime must be null or a valid HH:mm value");
        }
        task.deadlineTime = json["deadlineTime"].asString();
    }

    if (json.isMember("estimatedDurationMinutes") &&
        !json["estimatedDurationMinutes"].isNull())
    {
        if (!json["estimatedDurationMinutes"].isInt() ||
            json["estimatedDurationMinutes"].asInt() <= 0)
        {
            return invalid("estimatedDurationMinutes must be null or a positive integer");
        }
        task.estimatedDurationMinutes = json["estimatedDurationMinutes"].asInt();
    }

    if (json.isMember("categoryId") && !json["categoryId"].isNull())
    {
        if (!json["categoryId"].isString() || trim(json["categoryId"].asString()).empty())
        {
            return invalid("categoryId must be null or a non-empty string");
        }
        task.categoryId = json["categoryId"].asString();
    }

    TaskParseResult result;
    result.task = std::move(task);
    result.valid = true;
    return result;
}

} // namespace voicecalendar::http
