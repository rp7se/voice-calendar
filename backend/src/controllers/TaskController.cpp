#include "controllers/TaskController.h"

#include "http/HttpResponseUtils.h"
#include "http/TaskJson.h"

#include <drogon/utils/Utilities.h>

#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace voicecalendar::api
{
namespace
{
using http::ResponseCallback;
using http::sendError;

std::string utcNowIso8601()
{
    const auto now = std::chrono::system_clock::now();
    const auto seconds = std::chrono::time_point_cast<std::chrono::seconds>(now);
    const auto milliseconds = std::chrono::duration_cast<std::chrono::milliseconds>(now - seconds);
    const auto time = std::chrono::system_clock::to_time_t(now);

    std::tm utc{};
#ifdef _WIN32
    gmtime_s(&utc, &time);
#else
    gmtime_r(&time, &utc);
#endif

    std::ostringstream output;
    output << std::put_time(&utc, "%Y-%m-%dT%H:%M:%S")
           << '.' << std::setw(3) << std::setfill('0') << milliseconds.count()
           << 'Z';
    return output.str();
}
} // namespace

void TaskController::listTasks(
    const drogon::HttpRequestPtr&,
    ResponseCallback&& callback) const
{
    try
    {
        Json::Value body(Json::arrayValue);
        for (const auto& task : repository_.findAll())
        {
            body.append(http::taskToJson(task));
        }
        callback(http::jsonResponse(std::move(body), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Task API list failed", error);
    }
}

void TaskController::getTask(
    const drogon::HttpRequestPtr&,
    ResponseCallback&& callback,
    std::string id) const
{
    try
    {
        const auto task = repository_.findById(id);
        if (!task)
        {
            sendError(callback, drogon::k404NotFound, "task_not_found", "Task not found");
            return;
        }
        callback(http::jsonResponse(http::taskToJson(*task), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Task API get failed", error);
    }
}

void TaskController::createTask(
    const drogon::HttpRequestPtr& request,
    ResponseCallback&& callback) const
{
    const auto& json = request->getJsonObject();
    if (!json)
    {
        sendError(callback, drogon::k400BadRequest, "invalid_json", "Request body must contain valid JSON");
        return;
    }
    if (!json->isObject())
    {
        sendError(callback, drogon::k400BadRequest, "invalid_request", "Request JSON must be an object");
        return;
    }

    auto parsed = http::parseTaskInput(*json);
    if (!parsed.valid)
    {
        sendError(callback, drogon::k400BadRequest, "invalid_task", parsed.errorMessage);
        return;
    }

    try
    {
        if (!parsed.task.id.empty() && repository_.findById(parsed.task.id))
        {
            sendError(callback, drogon::k409Conflict, "task_exists", "A task with this id already exists");
            return;
        }
        if (parsed.task.id.empty())
        {
            parsed.task.id = drogon::utils::getUuid();
        }
        parsed.task.createdAt = utcNowIso8601();
        parsed.task.updatedAt = parsed.task.createdAt;
        const auto task = repository_.create(parsed.task);
        callback(http::jsonResponse(http::taskToJson(task), drogon::k201Created));
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Task API create failed", error);
    }
}

void TaskController::updateTask(
    const drogon::HttpRequestPtr& request,
    ResponseCallback&& callback,
    std::string id) const
{
    try
    {
        const auto existing = repository_.findById(id);
        if (!existing)
        {
            sendError(callback, drogon::k404NotFound, "task_not_found", "Task not found");
            return;
        }

        const auto& json = request->getJsonObject();
        if (!json)
        {
            sendError(callback, drogon::k400BadRequest, "invalid_json", "Request body must contain valid JSON");
            return;
        }
        if (!json->isObject())
        {
            sendError(callback, drogon::k400BadRequest, "invalid_request", "Request JSON must be an object");
            return;
        }

        auto parsed = http::parseTaskInput(*json, id);
        if (!parsed.valid)
        {
            sendError(callback, drogon::k400BadRequest, "invalid_task", parsed.errorMessage);
            return;
        }

        parsed.task.createdAt = existing->createdAt;
        parsed.task.schedulingStatus = existing->schedulingStatus;
        parsed.task.scheduledEventId = existing->scheduledEventId;
        parsed.task.scheduledAt = existing->scheduledAt;
        parsed.task.updatedAt = utcNowIso8601();
        if (!repository_.update(parsed.task))
        {
            sendError(callback, drogon::k404NotFound, "task_not_found", "Task not found");
            return;
        }
        callback(http::jsonResponse(http::taskToJson(parsed.task), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Task API update failed", error);
    }
}

void TaskController::linkTaskScheduling(
    const drogon::HttpRequestPtr& request,
    ResponseCallback&& callback,
    std::string id) const
{
    const auto& json = request->getJsonObject();
    if (!json)
    {
        sendError(callback, drogon::k400BadRequest, "invalid_json", "Request body must contain valid JSON");
        return;
    }
    if (!json->isObject() || !json->isMember("eventId") || !(*json)["eventId"].isString())
    {
        sendError(callback, drogon::k400BadRequest, "invalid_scheduling_link", "eventId is required and must be a string");
        return;
    }

    const auto eventId = (*json)["eventId"].asString();
    if (eventId.find_first_not_of(" \t\r\n") == std::string::npos)
    {
        sendError(callback, drogon::k400BadRequest, "invalid_scheduling_link", "eventId must not be empty");
        return;
    }

    try
    {
        const auto task = repository_.findById(id);
        if (!task)
        {
            sendError(callback, drogon::k404NotFound, "task_not_found", "Task not found");
            return;
        }
        if (task->schedulingStatus == models::TaskSchedulingStatus::Scheduled)
        {
            sendError(
                callback,
                drogon::k409Conflict,
                "task_already_scheduled",
                "Task is already linked to a scheduled event");
            return;
        }
        if (!eventRepository_.findById(eventId))
        {
            sendError(callback, drogon::k404NotFound, "event_not_found", "Event not found");
            return;
        }

        const auto scheduledAt = utcNowIso8601();
        if (!repository_.linkScheduling(id, eventId, scheduledAt))
        {
            const auto currentTask = repository_.findById(id);
            if (!currentTask)
            {
                sendError(callback, drogon::k404NotFound, "task_not_found", "Task not found");
                return;
            }
            if (!eventRepository_.findById(eventId))
            {
                sendError(callback, drogon::k404NotFound, "event_not_found", "Event not found");
                return;
            }
            if (currentTask->schedulingStatus != models::TaskSchedulingStatus::Scheduled)
            {
                throw std::runtime_error("Task scheduling link did not update an eligible task");
            }
            sendError(
                callback,
                drogon::k409Conflict,
                "task_already_scheduled",
                "Task is already linked to a scheduled event");
            return;
        }

        const auto updated = repository_.findById(id);
        if (!updated)
        {
            throw std::runtime_error("Task scheduling link succeeded but the task could not be reloaded");
        }
        callback(http::jsonResponse(http::taskToJson(*updated), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Task scheduling link failed", error);
    }
}

void TaskController::deleteTask(
    const drogon::HttpRequestPtr&,
    ResponseCallback&& callback,
    std::string id) const
{
    try
    {
        if (!repository_.remove(id))
        {
            sendError(callback, drogon::k404NotFound, "task_not_found", "Task not found");
            return;
        }

        auto response = drogon::HttpResponse::newHttpResponse();
        response->setStatusCode(drogon::k204NoContent);
        callback(response);
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Task API delete failed", error);
    }
}

} // namespace voicecalendar::api
