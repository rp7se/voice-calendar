#include "controllers/ReminderController.h"

#include "http/ReminderJson.h"

#include <stdexcept>

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
    LOG_ERROR << "Reminder API database operation failed: " << error.what();
    sendError(
        callback,
        drogon::k500InternalServerError,
        "internal_error",
        "An internal server error occurred");
}
} // namespace

void ReminderController::listPending(
    const drogon::HttpRequestPtr&,
    ResponseCallback&& callback) const
{
    try
    {
        Json::Value body(Json::arrayValue);
        for (const auto& delivery : repository_.findPending())
        {
            body.append(http::reminderDeliveryToJson(delivery));
        }
        callback(jsonResponse(std::move(body), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        sendInternalError(callback, error);
    }
}

void ReminderController::acknowledge(
    const drogon::HttpRequestPtr&,
    ResponseCallback&& callback,
    std::string id) const
{
    try
    {
        const auto existing = repository_.findById(id);
        if (!existing)
        {
            sendError(
                callback,
                drogon::k404NotFound,
                "reminder_not_found",
                "Reminder not found");
            return;
        }

        if (existing->status == models::ReminderStatus::Pending)
        {
            repository_.acknowledge(id);
        }

        const auto updated = repository_.findById(id);
        if (!updated)
        {
            throw std::runtime_error("Reminder disappeared while being acknowledged");
        }
        callback(jsonResponse(http::reminderDeliveryToJson(*updated), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        sendInternalError(callback, error);
    }
}

} // namespace voicecalendar::api
