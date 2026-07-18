#pragma once

#include <drogon/HttpResponse.h>

#include <exception>
#include <functional>
#include <string>
#include <string_view>

namespace voicecalendar::http
{

using ResponseCallback = std::function<void(const drogon::HttpResponsePtr&)>;

drogon::HttpResponsePtr jsonResponse(
    Json::Value body,
    drogon::HttpStatusCode status);

void sendError(
    ResponseCallback& callback,
    drogon::HttpStatusCode status,
    const std::string& error,
    const std::string& message,
    Json::Value extra = Json::Value(Json::objectValue));

void sendInternalError(
    ResponseCallback& callback,
    std::string_view operation,
    const std::exception& error);

} // namespace voicecalendar::http
