#pragma once

#include "repositories/EventRepository.h"
#include "services/FreeTimeService.h"

#include <drogon/HttpController.h>

namespace voicecalendar::api
{

class FreeTimeController final : public drogon::HttpController<FreeTimeController>
{
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(FreeTimeController::getFreeTime, "/api/free-time", drogon::Get);
    METHOD_LIST_END

    void getFreeTime(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback) const;

private:
    repositories::EventRepository repository_;
    services::FreeTimeService freeTimeService_;
};

} // namespace voicecalendar::api
