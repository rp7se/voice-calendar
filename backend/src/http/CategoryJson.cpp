#include "http/CategoryJson.h"

#include <algorithm>
#include <cctype>

namespace voicecalendar::http
{
namespace
{
CategoryParseResult invalid(std::string message)
{
    CategoryParseResult result;
    result.errorMessage = std::move(message);
    return result;
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
} // namespace

Json::Value categoryToJson(const models::Category& category)
{
    Json::Value json(Json::objectValue);
    json["id"] = category.id;
    json["name"] = category.name;
    if (!category.description.empty())
    {
        json["description"] = category.description;
    }
    json["createdAt"] = category.createdAt;
    json["updatedAt"] = category.updatedAt;
    return json;
}

CategoryParseResult parseCategoryInput(
    const Json::Value& json,
    const std::optional<std::string>& expectedId)
{
    models::Category category;

    if (json.isMember("id"))
    {
        if (!json["id"].isString() || trim(json["id"].asString()).empty())
        {
            return invalid("id must be a non-empty string");
        }
        category.id = json["id"].asString();
        if (expectedId && category.id != *expectedId)
        {
            return invalid("id must match the request path");
        }
    }
    else if (expectedId)
    {
        category.id = *expectedId;
    }

    if (!json.isMember("name") || !json["name"].isString())
    {
        return invalid("name is required and must be a string");
    }
    category.name = trim(json["name"].asString());
    if (category.name.empty())
    {
        return invalid("name must not be empty");
    }

    if (json.isMember("description") && !json["description"].isNull())
    {
        if (!json["description"].isString())
        {
            return invalid("description must be null or a string");
        }
        category.description = json["description"].asString();
    }

    CategoryParseResult result;
    result.category = std::move(category);
    result.valid = true;
    return result;
}

} // namespace voicecalendar::http
