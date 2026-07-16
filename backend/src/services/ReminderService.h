#pragma once

#include "repositories/ReminderRepository.h"

#include <trantor/net/EventLoop.h>

#include <chrono>

namespace voicecalendar::services
{

class ReminderService
{
public:
    explicit ReminderService(
        std::chrono::seconds scanInterval = std::chrono::seconds(30));
    ~ReminderService();

    ReminderService(const ReminderService&) = delete;
    ReminderService& operator=(const ReminderService&) = delete;

    void start(trantor::EventLoop* eventLoop);
    void stop();

private:
    repositories::ReminderRepository repository_;
    std::chrono::seconds scanInterval_;
    trantor::EventLoop* eventLoop_{nullptr};
    trantor::TimerId timerId_{trantor::InvalidTimerId};

    void scanSafely() const noexcept;
    void scan(std::chrono::system_clock::time_point now) const;
};

} // namespace voicecalendar::services
