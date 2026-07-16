#include "repositories/CategoryRepository.h"

#include "database/DatabaseManager.h"

#include <drogon/orm/DbClient.h>
#include <drogon/orm/Field.h>

#include <stdexcept>

namespace voicecalendar::repositories
{
namespace
{
models::Category categoryFromRow(const drogon::orm::Row& row)
{
    models::Category category;
    category.id = row["id"].as<std::string>();
    category.name = row["name"].as<std::string>();
    category.description = row["description"].as<std::string>();
    category.createdAt = row["created_at"].as<std::string>();
    category.updatedAt = row["updated_at"].as<std::string>();
    return category;
}

constexpr auto kCategoryColumns =
    "id, name, description, created_at, updated_at ";
} // namespace

std::vector<models::Category> CategoryRepository::findAll() const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        std::string("SELECT ") + kCategoryColumns +
        "FROM categories ORDER BY created_at ASC, name COLLATE NOCASE ASC, id ASC;");

    std::vector<models::Category> categories;
    categories.reserve(result.size());
    for (const auto& row : result)
    {
        categories.push_back(categoryFromRow(row));
    }
    return categories;
}

std::optional<models::Category> CategoryRepository::findById(const std::string& id) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        std::string("SELECT ") + kCategoryColumns +
        "FROM categories WHERE id = ?;",
        id);
    if (result.empty())
    {
        return std::nullopt;
    }
    return categoryFromRow(result.front());
}

bool CategoryRepository::existsByName(
    const std::string& name,
    const std::optional<std::string>& excludeId) const
{
    drogon::orm::Result result;
    if (excludeId)
    {
        result = database::DatabaseManager::instance().client()->execSqlSync(
            "SELECT 1 FROM categories WHERE name = ? COLLATE NOCASE AND id <> ? LIMIT 1;",
            name,
            *excludeId);
    }
    else
    {
        result = database::DatabaseManager::instance().client()->execSqlSync(
            "SELECT 1 FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1;",
            name);
    }
    return !result.empty();
}

models::Category CategoryRepository::create(const models::Category& category) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "INSERT INTO categories (id, name, description, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?);",
        category.id,
        category.name,
        category.description,
        category.createdAt,
        category.updatedAt);
    if (result.affectedRows() != 1)
    {
        throw std::runtime_error("Category insert did not affect exactly one row");
    }
    return category;
}

bool CategoryRepository::update(const models::Category& category) const
{
    const auto result = database::DatabaseManager::instance().client()->execSqlSync(
        "UPDATE categories SET name = ?, description = ?, updated_at = ? WHERE id = ?;",
        category.name,
        category.description,
        category.updatedAt,
        category.id);
    return result.affectedRows() == 1;
}

bool CategoryRepository::removeWithAssociations(const std::string& id) const
{
    auto transaction = database::DatabaseManager::instance().client()->newTransaction(
        drogon::orm::TransactionType::Immediate);

    transaction->execSqlSync(
        "UPDATE events SET category_id = NULL WHERE category_id = ?;",
        id);
    transaction->execSqlSync(
        "UPDATE tasks SET category_id = NULL WHERE category_id = ?;",
        id);
    const auto deleted = transaction->execSqlSync(
        "DELETE FROM categories WHERE id = ?;",
        id);

    if (deleted.affectedRows() != 1)
    {
        transaction->rollback();
        return false;
    }

    transaction.reset();
    return true;
}

} // namespace voicecalendar::repositories
