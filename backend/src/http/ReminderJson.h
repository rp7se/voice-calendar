#pragma once

#include "models/Reminder.h"

#include <json/json.h>

namespace voicecalendar::http
{

Json::Value reminderDeliveryToJson(const models::ReminderDelivery& delivery);

} // namespace voicecalendar::http
