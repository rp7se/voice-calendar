#pragma once

#include "repositories/ReminderRepository.h"

#include <drogon/HttpController.h>

namespace voicecalendar::api
{

class ReminderController final : public drogon::HttpController<ReminderController>
{
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(
        ReminderController::listPending,
        "/api/reminders/pending",
        drogon::Get);
    ADD_METHOD_TO(
        ReminderController::acknowledge,
        "/api/reminders/{id}/ack",
        drogon::Post);
    METHOD_LIST_END

    void listPending(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback) const;

    void acknowledge(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
        std::string id) const;

private:
    repositories::ReminderRepository repository_;
};

} // namespace voicecalendar::api
