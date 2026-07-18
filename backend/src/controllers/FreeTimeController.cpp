#include "controllers/FreeTimeController.h"

#include "http/HttpResponseUtils.h"
#include "utils/DateTimeUtils.h"

namespace voicecalendar::api
{
namespace
{
using http::ResponseCallback;

void sendInvalidQuery(ResponseCallback& callback, const std::string& message)
{
    http::sendError(
        callback,
        drogon::k400BadRequest,
        "invalid_query",
        message);
}
} // namespace

void FreeTimeController::getFreeTime(
    const drogon::HttpRequestPtr& request,
    ResponseCallback&& callback) const
{
    const auto date = request->getParameter("date");
    const auto start = request->getParameter("start");
    const auto end = request->getParameter("end");
    if (date.empty() || start.empty() || end.empty())
    {
        sendInvalidQuery(callback, "date, start, and end are required");
        return;
    }
    if (!utils::isValidDate(date))
    {
        sendInvalidQuery(callback, "date must be a valid YYYY-MM-DD value");
        return;
    }

    const auto startMinutes = utils::parseTimeToMinutes(start);
    const auto endMinutes = utils::parseTimeToMinutes(end);
    if (!startMinutes || !endMinutes)
    {
        sendInvalidQuery(callback, "start and end must be valid HH:mm values");
        return;
    }
    if (*startMinutes >= *endMinutes)
    {
        sendInvalidQuery(callback, "start must be earlier than end");
        return;
    }

    try
    {
        Json::Value body(Json::objectValue);
        body["date"] = date;
        body["range"]["start"] = start;
        body["range"]["end"] = end;
        body["freeSlots"] = Json::Value(Json::arrayValue);
        for (const auto& slot : freeTimeService_.findFreeSlots(
                 repository_,
                 date,
                 *startMinutes,
                 *endMinutes))
        {
            Json::Value freeSlot(Json::objectValue);
            freeSlot["start"] = utils::formatMinutesAsTime(slot.startMinutes);
            freeSlot["end"] = utils::formatMinutesAsTime(slot.endMinutes);
            freeSlot["durationMinutes"] = slot.endMinutes - slot.startMinutes;
            body["freeSlots"].append(std::move(freeSlot));
        }
        callback(http::jsonResponse(std::move(body), drogon::k200OK));
    }
    catch (const std::exception& error)
    {
        http::sendInternalError(callback, "Free time query failed", error);
    }
}

} // namespace voicecalendar::api
