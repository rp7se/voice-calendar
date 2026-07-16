#pragma once

#include "models/Event.h"

#include <optional>
#include <string>
#include <vector>

namespace voicecalendar::repositories
{

class EventRepository
{
public:
    std::vector<models::Event> findAll() const;
    std::optional<models::Event> findById(const std::string& id) const;
    std::vector<models::Event> findPotentialConflicts(
        const std::string& date,
        const std::optional<std::string>& excludeEventId = std::nullopt) const;
    models::Event create(const models::Event& event) const;
    bool update(const models::Event& event) const;
    bool remove(const std::string& id) const;
};

} // namespace voicecalendar::repositories
