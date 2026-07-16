#pragma once

#include "models/Task.h"

#include <optional>
#include <string>
#include <vector>

namespace voicecalendar::repositories
{

class TaskRepository
{
public:
    std::vector<models::Task> findAll() const;
    std::optional<models::Task> findById(const std::string& id) const;
    models::Task create(const models::Task& task) const;
    bool update(const models::Task& task) const;
    bool remove(const std::string& id) const;
};

} // namespace voicecalendar::repositories
