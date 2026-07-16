#pragma once

#include "repositories/EventRepository.h"
#include "services/FreeTimeService.h"
#include "services/TaskSchedulerService.h"

#include <drogon/HttpController.h>

namespace voicecalendar::api
{

class SchedulingController final : public drogon::HttpController<SchedulingController>
{
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(
        SchedulingController::preview,
        "/api/scheduling/preview",
        drogon::Post);
    METHOD_LIST_END

    void preview(
        const drogon::HttpRequestPtr& request,
        std::function<void(const drogon::HttpResponsePtr&)>&& callback) const;

private:
    repositories::EventRepository repository_;
    services::FreeTimeService freeTimeService_;
    services::TaskSchedulerService schedulerService_;
};

} // namespace voicecalendar::api
