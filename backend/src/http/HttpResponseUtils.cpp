#include "http/HttpResponseUtils.h"

#include <drogon/drogon.h>

#include <utility>

namespace voicecalendar::http
{

drogon::HttpResponsePtr jsonResponse(
    Json::Value body,
    drogon::HttpStatusCode status)
{
    auto response = drogon::HttpResponse::newHttpJsonResponse(std::move(body));
    response->setStatusCode(status);
    return response;
}

void sendError(
    ResponseCallback& callback,
    drogon::HttpStatusCode status,
    const std::string& error,
    const std::string& message,
    Json::Value extra)
{
    Json::Value body(Json::objectValue);
    body["error"] = error;
    body["message"] = message;
    if (extra.isObject())
    {
        for (const auto& name : extra.getMemberNames())
        {
            if (name != "error" && name != "message")
            {
                body[name] = std::move(extra[name]);
            }
        }
    }
    callback(jsonResponse(std::move(body), status));
}

void sendInternalError(
    ResponseCallback& callback,
    std::string_view operation,
    const std::exception& error)
{
    LOG_ERROR << operation << ": " << error.what();
    sendError(
        callback,
        drogon::k500InternalServerError,
        "internal_error",
        "An internal server error occurred");
}

} // namespace voicecalendar::http
