#include "controllers/TaskController.h"

#include "http/TaskJson.h"

#include <drogon/utils/Utilities.h>

#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>

namespace voicecalendar::api
{
namespace
{
using ResponseCallback = std::function<void(const drogon::HttpResponsePtr&)>;

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

void sendInternalError(ResponseCallback& callback, const std::exception& error)
{
    LOG_ERROR << "Task API database operation failed: " << error.what();
    sendError(
        callback,
        drogon::k500InternalServerError,
        "internal_error",
        "An internal server error occurred");
}

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
        callback(jsonResponse(std::move(body), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        sendInternalError(callback, error);
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
        callback(jsonResponse(http::taskToJson(*task), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        sendInternalError(callback, error);
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
        callback(jsonResponse(http::taskToJson(task), drogon::k201Created));
    }
    catch (const std::exception& error)
    {
        sendInternalError(callback, error);
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
        parsed.task.updatedAt = utcNowIso8601();
        if (!repository_.update(parsed.task))
        {
            sendError(callback, drogon::k404NotFound, "task_not_found", "Task not found");
            return;
        }
        callback(jsonResponse(http::taskToJson(parsed.task), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        sendInternalError(callback, error);
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
        sendInternalError(callback, error);
    }
}

} // namespace voicecalendar::api
