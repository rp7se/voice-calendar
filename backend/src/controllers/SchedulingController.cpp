#include "controllers/SchedulingController.h"

#include "models/Scheduling.h"
#include "utils/DateTimeUtils.h"

#include <algorithm>
#include <cctype>
#include <limits>
#include <optional>
#include <unordered_set>

namespace voicecalendar::api
{
namespace
{
using ResponseCallback = std::function<void(const drogon::HttpResponsePtr&)>;

struct SchedulingRequest
{
    std::string date;
    std::string rangeStart;
    std::string rangeEnd;
    int rangeStartMinutes{0};
    int rangeEndMinutes{0};
    std::vector<models::SchedulingTask> tasks;
};

struct SchedulingRequestParseResult
{
    SchedulingRequest request;
    std::string errorMessage;
    bool valid{false};
};

drogon::HttpResponsePtr jsonResponse(Json::Value body, drogon::HttpStatusCode status)
{
    auto response = drogon::HttpResponse::newHttpJsonResponse(std::move(body));
    response->setStatusCode(status);
    return response;
}

void sendError(
    ResponseCallback& callback,
    drogon::HttpStatusCode status,
    const std::string& error,
    const std::string& message)
{
    Json::Value body(Json::objectValue);
    body["error"] = error;
    body["message"] = message;
    callback(jsonResponse(std::move(body), status));
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

std::optional<models::SchedulingTaskStatus> parseStatus(const Json::Value& value)
{
    if (!value.isString())
    {
        return std::nullopt;
    }
    if (value.asString() == "pending")
    {
        return models::SchedulingTaskStatus::Pending;
    }
    if (value.asString() == "completed")
    {
        return models::SchedulingTaskStatus::Completed;
    }
    return std::nullopt;
}

std::optional<models::SchedulingTaskPriority> parsePriority(const Json::Value& value)
{
    if (!value.isString())
    {
        return std::nullopt;
    }
    if (value.asString() == "high")
    {
        return models::SchedulingTaskPriority::High;
    }
    if (value.asString() == "medium")
    {
        return models::SchedulingTaskPriority::Medium;
    }
    if (value.asString() == "low")
    {
        return models::SchedulingTaskPriority::Low;
    }
    return std::nullopt;
}

SchedulingRequestParseResult invalid(std::string message)
{
    SchedulingRequestParseResult result;
    result.errorMessage = std::move(message);
    return result;
}

SchedulingRequestParseResult parseSchedulingRequest(const Json::Value& json)
{
    if (!json.isObject())
    {
        return invalid("Request JSON must be an object");
    }
    if (!json.isMember("date") || !json["date"].isString() ||
        !utils::isValidDate(json["date"].asString()))
    {
        return invalid("date must be a valid YYYY-MM-DD value");
    }
    if (!json.isMember("range") || !json["range"].isObject())
    {
        return invalid("range must be an object with start and end");
    }

    const auto& range = json["range"];
    if (!range.isMember("start") || !range["start"].isString() ||
        !range.isMember("end") || !range["end"].isString())
    {
        return invalid("range.start and range.end must be HH:mm strings");
    }
    const auto rangeStart = utils::parseTimeToMinutes(range["start"].asString());
    const auto rangeEnd = utils::parseTimeToMinutes(range["end"].asString());
    if (!rangeStart || !rangeEnd)
    {
        return invalid("range.start and range.end must be valid HH:mm values");
    }
    if (*rangeStart >= *rangeEnd)
    {
        return invalid("range.start must be earlier than range.end");
    }
    if (!json.isMember("tasks") || !json["tasks"].isArray())
    {
        return invalid("tasks must be an array");
    }

    SchedulingRequest parsed;
    parsed.date = json["date"].asString();
    parsed.rangeStart = range["start"].asString();
    parsed.rangeEnd = range["end"].asString();
    parsed.rangeStartMinutes = *rangeStart;
    parsed.rangeEndMinutes = *rangeEnd;
    parsed.tasks.reserve(json["tasks"].size());
    std::unordered_set<std::string> taskIds;

    for (Json::ArrayIndex index = 0; index < json["tasks"].size(); ++index)
    {
        const auto& value = json["tasks"][index];
        if (!value.isObject())
        {
            return invalid("Each task must be an object");
        }
        if (!value.isMember("id") || !value["id"].isString() ||
            trim(value["id"].asString()).empty())
        {
            return invalid("Each task requires a non-empty string id");
        }
        if (!value.isMember("title") || !value["title"].isString())
        {
            return invalid("Each task requires a string title");
        }

        models::SchedulingTask task;
        task.id = trim(value["id"].asString());
        task.title = trim(value["title"].asString());
        if (task.title.empty())
        {
            return invalid("Each task requires a non-empty title");
        }
        if (!taskIds.insert(task.id).second)
        {
            return invalid("Task id values must be unique");
        }

        if (!value.isMember("status"))
        {
            return invalid("Each task requires status pending or completed");
        }
        const auto status = parseStatus(value["status"]);
        if (!status)
        {
            return invalid("Task status must be pending or completed");
        }
        task.status = *status;

        if (!value.isMember("priority"))
        {
            return invalid("Each task requires priority high, medium, or low");
        }
        const auto priority = parsePriority(value["priority"]);
        if (!priority)
        {
            return invalid("Task priority must be high, medium, or low");
        }
        task.priority = *priority;

        if (value.isMember("deadlineDate") && !value["deadlineDate"].isNull())
        {
            if (!value["deadlineDate"].isString() ||
                !utils::isValidDate(value["deadlineDate"].asString()))
            {
                return invalid("Task deadlineDate must be a valid YYYY-MM-DD value");
            }
            task.deadlineDate = value["deadlineDate"].asString();
        }
        if (value.isMember("deadlineTime") && !value["deadlineTime"].isNull())
        {
            if (!task.deadlineDate || !value["deadlineTime"].isString())
            {
                return invalid("Task deadlineTime requires deadlineDate");
            }
            const auto deadlineTime = utils::parseTimeToMinutes(
                value["deadlineTime"].asString());
            if (!deadlineTime)
            {
                return invalid("Task deadlineTime must be a valid HH:mm value");
            }
            task.deadlineTimeMinutes = *deadlineTime;
        }

        if (!value.isMember("estimatedDurationMinutes") ||
            value["estimatedDurationMinutes"].isNull())
        {
            task.durationState = models::EstimatedDurationState::Missing;
        }
        else if (!value["estimatedDurationMinutes"].isInt() ||
                 value["estimatedDurationMinutes"].asInt() <= 0)
        {
            task.durationState = models::EstimatedDurationState::Invalid;
        }
        else
        {
            task.durationState = models::EstimatedDurationState::Valid;
            task.estimatedDurationMinutes = value["estimatedDurationMinutes"].asInt();
        }
        task.inputOrder = index;
        parsed.tasks.push_back(std::move(task));
    }

    SchedulingRequestParseResult result;
    result.request = std::move(parsed);
    result.valid = true;
    return result;
}

Json::Value schedulingResultToJson(
    const SchedulingRequest& request,
    const models::SchedulingResult& result)
{
    Json::Value body(Json::objectValue);
    body["date"] = request.date;
    body["range"]["start"] = request.rangeStart;
    body["range"]["end"] = request.rangeEnd;
    body["strategy"] = "edf_priority_first_fit_v1";
    body["scheduled"] = Json::Value(Json::arrayValue);
    for (const auto& task : result.scheduled)
    {
        Json::Value scheduled(Json::objectValue);
        scheduled["taskId"] = task.taskId;
        scheduled["title"] = task.title;
        scheduled["start"] = utils::formatMinutesAsTime(task.startMinutes);
        scheduled["end"] = utils::formatMinutesAsTime(task.endMinutes);
        scheduled["durationMinutes"] = task.endMinutes - task.startMinutes;
        body["scheduled"].append(std::move(scheduled));
    }

    body["unscheduled"] = Json::Value(Json::arrayValue);
    for (const auto& task : result.unscheduled)
    {
        Json::Value unscheduled(Json::objectValue);
        unscheduled["taskId"] = task.taskId;
        unscheduled["title"] = task.title;
        unscheduled["reason"] = task.reason;
        body["unscheduled"].append(std::move(unscheduled));
    }

    body["summary"]["totalTasks"] = result.totalTasks;
    body["summary"]["scheduledTasks"] = static_cast<int>(result.scheduled.size());
    body["summary"]["unscheduledTasks"] = static_cast<int>(result.unscheduled.size());
    body["summary"]["skippedCompletedTasks"] = result.skippedCompletedTasks;
    body["summary"]["scheduledMinutes"] = result.scheduledMinutes;
    return body;
}
} // namespace

void SchedulingController::preview(
    const drogon::HttpRequestPtr& request,
    ResponseCallback&& callback) const
{
    const auto& json = request->getJsonObject();
    if (!json)
    {
        sendError(
            callback,
            drogon::k400BadRequest,
            "invalid_json",
            "Request body must contain valid JSON");
        return;
    }

    auto parsed = parseSchedulingRequest(*json);
    if (!parsed.valid)
    {
        sendError(
            callback,
            drogon::k400BadRequest,
            "invalid_scheduling_request",
            parsed.errorMessage);
        return;
    }

    try
    {
        const auto result = schedulerService_.createPreview(
            repository_,
            freeTimeService_,
            parsed.request.date,
            parsed.request.rangeStartMinutes,
            parsed.request.rangeEndMinutes,
            parsed.request.tasks);
        callback(jsonResponse(
            schedulingResultToJson(parsed.request, result),
            drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        LOG_ERROR << "Scheduling preview failed: " << error.what();
        sendError(
            callback,
            drogon::k500InternalServerError,
            "internal_error",
            "An internal server error occurred");
    }
}

} // namespace voicecalendar::api
