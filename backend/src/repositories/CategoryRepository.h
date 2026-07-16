#pragma once

#include "models/Category.h"

#include <optional>
#include <string>
#include <vector>

namespace voicecalendar::repositories
{

class CategoryRepository
{
public:
    std::vector<models::Category> findAll() const;
    std::optional<models::Category> findById(const std::string& id) const;
    bool existsByName(
        const std::string& name,
        const std::optional<std::string>& excludeId = std::nullopt) const;
    models::Category create(const models::Category& category) const;
    bool update(const models::Category& category) const;
    bool removeWithAssociations(const std::string& id) const;
};

} // namespace voicecalendar::repositories
