#pragma once

#include "models/Reminder.h"

#include <drogon/HttpResponse.h>
#include <trantor/net/EventLoop.h>

#include <chrono>
#include <cstdint>
#include <memory>
#include <mutex>
#include <unordered_map>

namespace voicecalendar::services
{

class ReminderStreamService
{
public:
    static ReminderStreamService& instance();

    void start(
        trantor::EventLoop* eventLoop,
        std::chrono::seconds heartbeatInterval = std::chrono::seconds(15));
    void stop();

    void addClient(drogon::ResponseStreamPtr stream);
    void broadcast(const models::ReminderDelivery& delivery);

private:
    using Stream = std::shared_ptr<drogon::ResponseStream>;

    std::mutex mutex_;
    std::unordered_map<std::uint64_t, Stream> clients_;
    std::uint64_t nextClientId_{1};
    trantor::EventLoop* eventLoop_{nullptr};
    trantor::TimerId heartbeatTimerId_{trantor::InvalidTimerId};

    void sendToClients(const std::string& message);
    void sendHeartbeat();
};

} // namespace voicecalendar::services
