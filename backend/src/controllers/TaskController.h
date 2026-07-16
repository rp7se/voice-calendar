#pragma once

#include "repositories/EventRepository.h"
#include "repositories/TaskRepository.h"

#include <drogon/HttpController.h>

namespace voicecalendar::api
{

class TaskController final : public drogon::HttpController<TaskController>
{
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(TaskController::listTasks, "/api/tasks", drogon::Get);
    ADD_METHOD_TO(TaskController::getTask, "/api/tasks/{id}", drogon::Get);
    ADD_METHOD_TO(TaskController::createTask, "/api/tasks", drogon::Post);
    ADD_METHOD_TO(TaskController::updateTask, "/api/tasks/{id}", drogon::Put);
    ADD_METHOD_TO(
        TaskController::linkTaskScheduling,
        "/api/tasks/{id}/scheduling",
        drogon::Put);
    ADD_METHOD_TO(TaskController::deleteTask, "/api/tasks/{id}", drogon::Delete);
    METHOD_LIST_END

    void listTasks(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback) const;

    void getTask(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
        std::string id) const;

    void createTask(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback) const;

    void updateTask(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
        std::string id) const;

    void deleteTask(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
        std::string id) const;

    void linkTaskScheduling(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
        std::string id) const;

private:
    repositories::TaskRepository repository_;
    repositories::EventRepository eventRepository_;
};

} // namespace voicecalendar::api
