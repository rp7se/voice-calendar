#include "controllers/ReminderController.h"

#include "http/HttpResponseUtils.h"
#include "http/ReminderJson.h"
#include "services/ReminderStreamService.h"

#include <stdexcept>

namespace voicecalendar::api
{
namespace
{
using http::ResponseCallback;
using http::sendError;
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
        callback(http::jsonResponse(std::move(body), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Reminder API list failed", error);
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
        callback(http::jsonResponse(http::reminderDeliveryToJson(*updated), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Reminder acknowledgement failed", error);
    }
}

void ReminderController::stream(
    const drogon::HttpRequestPtr&,
    ResponseCallback&& callback) const
{
    auto response = drogon::HttpResponse::newAsyncStreamResponse(
        [](drogon::ResponseStreamPtr stream) {
            services::ReminderStreamService::instance().addClient(std::move(stream));
        },
        true);
    response->setContentTypeCodeAndCustomString(
        drogon::CT_CUSTOM,
        "text/event-stream; charset=utf-8");
    response->addHeader("Cache-Control", "no-cache, no-transform");
    response->addHeader("Connection", "keep-alive");
    response->addHeader("X-Accel-Buffering", "no");
    callback(response);
}

} // namespace voicecalendar::api
