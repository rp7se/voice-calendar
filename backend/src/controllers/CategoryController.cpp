#include "controllers/CategoryController.h"

#include "http/CategoryJson.h"

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
    LOG_ERROR << "Category API database operation failed: " << error.what();
    sendError(
        callback,
        drogon::k500InternalServerError,
        "internal_error",
        "An internal server error occurred");
}

void sendNameConflict(ResponseCallback& callback)
{
    sendError(
        callback,
        drogon::k409Conflict,
        "category_name_conflict",
        "A category with this name already exists");
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

void CategoryController::listCategories(
    const drogon::HttpRequestPtr&,
    ResponseCallback&& callback) const
{
    try
    {
        Json::Value body(Json::arrayValue);
        for (const auto& category : repository_.findAll())
        {
            body.append(http::categoryToJson(category));
        }
        callback(jsonResponse(std::move(body), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        sendInternalError(callback, error);
    }
}

void CategoryController::getCategory(
    const drogon::HttpRequestPtr&,
    ResponseCallback&& callback,
    std::string id) const
{
    try
    {
        const auto category = repository_.findById(id);
        if (!category)
        {
            sendError(callback, drogon::k404NotFound, "category_not_found", "Category not found");
            return;
        }
        callback(jsonResponse(http::categoryToJson(*category), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        sendInternalError(callback, error);
    }
}

void CategoryController::createCategory(
    const drogon::HttpRequestPtr& request,
    ResponseCallback&& callback) const
{
    const auto& json = request->getJsonObject();
    if (!json || !json->isObject())
    {
        sendError(callback, drogon::k400BadRequest, "invalid_json", "Request body must contain a JSON object");
        return;
    }

    auto parsed = http::parseCategoryInput(*json);
    if (!parsed.valid)
    {
        sendError(callback, drogon::k400BadRequest, "invalid_category", parsed.errorMessage);
        return;
    }

    try
    {
        if (repository_.existsByName(parsed.category.name))
        {
            sendNameConflict(callback);
            return;
        }
        if (!parsed.category.id.empty() && repository_.findById(parsed.category.id))
        {
            sendError(callback, drogon::k409Conflict, "category_exists", "A category with this id already exists");
            return;
        }
        if (parsed.category.id.empty())
        {
            parsed.category.id = drogon::utils::getUuid();
        }
        parsed.category.createdAt = utcNowIso8601();
        parsed.category.updatedAt = parsed.category.createdAt;
        const auto category = repository_.create(parsed.category);
        callback(jsonResponse(http::categoryToJson(category), drogon::k201Created));
    }
    catch (const std::exception& error)
    {
        sendInternalError(callback, error);
    }
}

void CategoryController::updateCategory(
    const drogon::HttpRequestPtr& request,
    ResponseCallback&& callback,
    std::string id) const
{
    try
    {
        const auto existing = repository_.findById(id);
        if (!existing)
        {
            sendError(callback, drogon::k404NotFound, "category_not_found", "Category not found");
            return;
        }

        const auto& json = request->getJsonObject();
        if (!json || !json->isObject())
        {
            sendError(callback, drogon::k400BadRequest, "invalid_json", "Request body must contain a JSON object");
            return;
        }

        auto parsed = http::parseCategoryInput(*json, id);
        if (!parsed.valid)
        {
            sendError(callback, drogon::k400BadRequest, "invalid_category", parsed.errorMessage);
            return;
        }
        if (repository_.existsByName(parsed.category.name, id))
        {
            sendNameConflict(callback);
            return;
        }

        parsed.category.createdAt = existing->createdAt;
        parsed.category.updatedAt = utcNowIso8601();
        if (!repository_.update(parsed.category))
        {
            sendError(callback, drogon::k404NotFound, "category_not_found", "Category not found");
            return;
        }
        callback(jsonResponse(http::categoryToJson(parsed.category), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        sendInternalError(callback, error);
    }
}

void CategoryController::deleteCategory(
    const drogon::HttpRequestPtr&,
    ResponseCallback&& callback,
    std::string id) const
{
    try
    {
        if (!repository_.findById(id) || !repository_.removeWithAssociations(id))
        {
            sendError(callback, drogon::k404NotFound, "category_not_found", "Category not found");
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
