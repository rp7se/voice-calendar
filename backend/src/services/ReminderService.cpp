#include "services/ReminderService.h"

#include "models/Reminder.h"
#include "utils/ReminderDateTime.h"

#include <drogon/drogon.h>
#include <drogon/utils/Utilities.h>

namespace voicecalendar::services
{

ReminderService::ReminderService(std::chrono::seconds scanInterval)
    : scanInterval_(scanInterval)
{
}

ReminderService::~ReminderService()
{
    stop();
}

void ReminderService::start(trantor::EventLoop* eventLoop)
{
    if (eventLoop == nullptr || timerId_ != trantor::InvalidTimerId)
    {
        return;
    }

    eventLoop_ = eventLoop;
    scanSafely();
    timerId_ = eventLoop_->runEvery(
        scanInterval_,
        [this]() {
            scanSafely();
        });
    LOG_INFO << "ReminderService started";
}

void ReminderService::stop()
{
    if (eventLoop_ != nullptr && timerId_ != trantor::InvalidTimerId)
    {
        eventLoop_->invalidateTimer(timerId_);
    }
    timerId_ = trantor::InvalidTimerId;
    eventLoop_ = nullptr;
}

void ReminderService::scanSafely() const noexcept
{
    try
    {
        scan(std::chrono::system_clock::now());
    }
    catch (const std::exception& error)
    {
        LOG_ERROR << "Reminder scan failed: " << error.what();
    }
}

void ReminderService::scan(std::chrono::system_clock::time_point now) const
{
    const auto firstDate = utils::formatLocalDate(now);
    const auto lastDate = utils::formatLocalDate(now + std::chrono::hours(24 * 8));

    for (const auto& candidate : repository_.findCandidates(firstDate, lastDate))
    {
        const auto timing = utils::calculateReminderTiming(
            candidate.date,
            candidate.startTime,
            candidate.reminderMinutesBefore);
        if (!timing)
        {
            LOG_WARN << "Reminder candidate has invalid local time: eventId="
                     << candidate.eventId;
            continue;
        }
        if (!utils::shouldTriggerReminder(
                *timing,
                candidate.reminderMinutesBefore,
                now))
        {
            continue;
        }

        models::ReminderDelivery delivery;
        delivery.id = drogon::utils::getUuid();
        delivery.eventId = candidate.eventId;
        delivery.scheduledFor = utils::formatLocalDateTime(timing->scheduledFor);
        delivery.triggeredAt = utils::formatUtcDateTime(now);
        delivery.createdAt = delivery.triggeredAt;

        if (repository_.createPending(candidate, delivery))
        {
            LOG_INFO << "Reminder triggered: eventId=" << candidate.eventId;
        }
    }
}

} // namespace voicecalendar::services
