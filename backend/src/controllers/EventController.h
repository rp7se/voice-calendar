#pragma once

#include "repositories/EventRepository.h"
#include "services/EventConflictService.h"

#include <drogon/HttpController.h>

namespace voicecalendar::api
{

class EventController final : public drogon::HttpController<EventController>
{
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(EventController::listEvents, "/api/events", drogon::Get);
    ADD_METHOD_TO(EventController::getEvent, "/api/events/{id}", drogon::Get);
    ADD_METHOD_TO(EventController::createEvent, "/api/events", drogon::Post);
    ADD_METHOD_TO(EventController::updateEvent, "/api/events/{id}", drogon::Put);
    ADD_METHOD_TO(EventController::deleteEvent, "/api/events/{id}", drogon::Delete);
    METHOD_LIST_END

    void listEvents(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback) const;

    void getEvent(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
        std::string id) const;

    void createEvent(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback) const;

    void updateEvent(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
        std::string id) const;

    void deleteEvent(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
        std::string id) const;

private:
    repositories::EventRepository repository_;
    services::EventConflictService conflictService_;
};

} // namespace voicecalendar::api
