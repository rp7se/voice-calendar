#pragma once

#include <string>

namespace voicecalendar::models
{

struct Category
{
    std::string id;
    std::string name;
    std::string description;
    std::string createdAt;
    std::string updatedAt;
};

} // namespace voicecalendar::models
