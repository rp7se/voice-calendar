#include "controllers/EventController.h"

#include "http/EventJson.h"
#include "http/HttpResponseUtils.h"

#include <drogon/utils/Utilities.h>

#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>

namespace voicecalendar::api
{
namespace
{
using http::ResponseCallback;
using http::sendError;

void sendConflict(
    ResponseCallback& callback,
    const std::vector<models::Event>& conflicts)
{
    Json::Value extra(Json::objectValue);
    extra["conflicts"] = Json::Value(Json::arrayValue);
    for (const auto& event : conflicts)
    {
        Json::Value conflict(Json::objectValue);
        conflict["id"] = event.id;
        conflict["title"] = event.title;
        conflict["date"] = event.date;
        conflict["startTime"] = event.startTime;
        conflict["endTime"] = *event.endTime;
        extra["conflicts"].append(std::move(conflict));
    }
    sendError(
        callback,
        drogon::k409Conflict,
        "event_conflict",
        "The event conflicts with an existing event",
        std::move(extra));
}

std::string utcNowIso8601()
{
    const auto now = std::chrono::system_clock::now();
    const auto seconds = std::chrono::time_point_cast<std::chrono::seconds>(now);
    const auto milliseconds = std::chrono::duration_cast<std::chrono::milliseconds>(
        now - seconds);
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

void EventController::listEvents(
    const drogon::HttpRequestPtr&,
    ResponseCallback&& callback) const
{
    try
    {
        Json::Value body(Json::arrayValue);
        for (const auto& event : repository_.findAll())
        {
            body.append(http::eventToJson(event));
        }
        callback(http::jsonResponse(std::move(body), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Event API list failed", error);
    }
}

void EventController::getEvent(
    const drogon::HttpRequestPtr&,
    ResponseCallback&& callback,
    std::string id) const
{
    try
    {
        const auto event = repository_.findById(id);
        if (!event)
        {
            sendError(callback, drogon::k404NotFound, "event_not_found", "Event not found");
            return;
        }
        callback(http::jsonResponse(http::eventToJson(*event), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Event API get failed", error);
    }
}

void EventController::createEvent(
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

    auto parsed = http::parseEventInput(*json);
    if (!parsed.valid)
    {
        sendError(callback, drogon::k400BadRequest, "invalid_event", parsed.errorMessage);
        return;
    }

    try
    {
        const auto conflictCheck = conflictService_.findConflicts(
            repository_,
            parsed.event);
        if (!conflictCheck.validTimeRange)
        {
            sendError(
                callback,
                drogon::k400BadRequest,
                "invalid_time_range",
                "Start time must be earlier than end time");
            return;
        }
        if (!conflictCheck.conflicts.empty())
        {
            sendConflict(callback, conflictCheck.conflicts);
            return;
        }

        parsed.event.id = drogon::utils::getUuid();
        parsed.event.createdAt = utcNowIso8601();
        parsed.event.updatedAt = parsed.event.createdAt;
        const auto event = repository_.create(parsed.event);
        callback(http::jsonResponse(http::eventToJson(event), drogon::k201Created));
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Event API create failed", error);
    }
}

void EventController::updateEvent(
    const drogon::HttpRequestPtr& request,
    ResponseCallback&& callback,
    std::string id) const
{
    try
    {
        const auto existing = repository_.findById(id);
        if (!existing)
        {
            sendError(callback, drogon::k404NotFound, "event_not_found", "Event not found");
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

        auto parsed = http::parseEventInput(*json, id);
        if (!parsed.valid)
        {
            sendError(callback, drogon::k400BadRequest, "invalid_event", parsed.errorMessage);
            return;
        }

        const auto conflictCheck = conflictService_.findConflicts(
            repository_,
            parsed.event,
            id);
        if (!conflictCheck.validTimeRange)
        {
            sendError(
                callback,
                drogon::k400BadRequest,
                "invalid_time_range",
                "Start time must be earlier than end time");
            return;
        }
        if (!conflictCheck.conflicts.empty())
        {
            sendConflict(callback, conflictCheck.conflicts);
            return;
        }

        parsed.event.createdAt = existing->createdAt;
        parsed.event.updatedAt = utcNowIso8601();
        const auto reminderScheduleChanged =
            parsed.event.date != existing->date ||
            parsed.event.startTime != existing->startTime ||
            parsed.event.reminderMinutesBefore != existing->reminderMinutesBefore;
        if (!repository_.update(parsed.event, reminderScheduleChanged))
        {
            sendError(callback, drogon::k404NotFound, "event_not_found", "Event not found");
            return;
        }
        callback(http::jsonResponse(http::eventToJson(parsed.event), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Event API update failed", error);
    }
}

void EventController::deleteEvent(
    const drogon::HttpRequestPtr&,
    ResponseCallback&& callback,
    std::string id) const
{
    try
    {
        if (!repository_.remove(id))
        {
            sendError(callback, drogon::k404NotFound, "event_not_found", "Event not found");
            return;
        }

        auto response = drogon::HttpResponse::newHttpResponse();
        response->setStatusCode(drogon::k204NoContent);
        callback(response);
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Event API delete failed", error);
    }
}

} // namespace voicecalendar::api
