#pragma once

#include "repositories/CategoryRepository.h"

#include <drogon/HttpController.h>

namespace voicecalendar::api
{

class CategoryController final : public drogon::HttpController<CategoryController>
{
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(CategoryController::listCategories, "/api/categories", drogon::Get);
    ADD_METHOD_TO(CategoryController::getCategory, "/api/categories/{id}", drogon::Get);
    ADD_METHOD_TO(CategoryController::createCategory, "/api/categories", drogon::Post);
    ADD_METHOD_TO(CategoryController::updateCategory, "/api/categories/{id}", drogon::Put);
    ADD_METHOD_TO(CategoryController::deleteCategory, "/api/categories/{id}", drogon::Delete);
    METHOD_LIST_END

    void listCategories(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback) const;

    void getCategory(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
        std::string id) const;

    void createCategory(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback) const;

    void updateCategory(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
        std::string id) const;

    void deleteCategory(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
        std::string id) const;

private:
    repositories::CategoryRepository repository_;
};

} // namespace voicecalendar::api
