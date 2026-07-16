#include "http/ReminderJson.h"

namespace voicecalendar::http
{

Json::Value reminderDeliveryToJson(const models::ReminderDelivery& delivery)
{
    Json::Value json(Json::objectValue);
    json["id"] = delivery.id;
    json["eventId"] = delivery.eventId;
    json["title"] = delivery.title;
    json["date"] = delivery.date;
    json["startTime"] = delivery.startTime;
    json["scheduledFor"] = delivery.scheduledFor;
    json["triggeredAt"] = delivery.triggeredAt;
    json["status"] = models::toStorageValue(delivery.status);
    return json;
}

} // namespace voicecalendar::http
