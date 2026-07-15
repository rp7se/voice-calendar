#include "controllers/HealthController.h"

#include <json/json.h>

namespace voicecalendar::api
{

void HealthController::health(
    const drogon::HttpRequestPtr&,
    std::function<void(const drogon::HttpResponsePtr&)>&& callback) const
{
    Json::Value responseBody;
    responseBody["status"] = "ok";
    responseBody["service"] = "voicecalendar-backend";
    responseBody["version"] = "0.1.0";

    auto response = drogon::HttpResponse::newHttpJsonResponse(responseBody);
    response->setStatusCode(drogon::k200OK);
    callback(response);
}

} // namespace voicecalendar::api
