#include "services/ReminderStreamService.h"

#include "http/ReminderJson.h"

#include <json/writer.h>

#include <sstream>
#include <utility>
#include <vector>

namespace voicecalendar::services
{

ReminderStreamService& ReminderStreamService::instance()
{
    static ReminderStreamService service;
    return service;
}

void ReminderStreamService::start(
    trantor::EventLoop* eventLoop,
    std::chrono::seconds heartbeatInterval)
{
    if (eventLoop == nullptr || heartbeatTimerId_ != trantor::InvalidTimerId)
    {
        return;
    }

    eventLoop_ = eventLoop;
    heartbeatTimerId_ = eventLoop_->runEvery(
        heartbeatInterval,
        [this]() {
            sendHeartbeat();
        });
}

void ReminderStreamService::stop()
{
    if (eventLoop_ != nullptr && heartbeatTimerId_ != trantor::InvalidTimerId)
    {
        eventLoop_->invalidateTimer(heartbeatTimerId_);
    }
    heartbeatTimerId_ = trantor::InvalidTimerId;
    eventLoop_ = nullptr;

    std::vector<Stream> clients;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        clients.reserve(clients_.size());
        for (auto& [clientId, stream] : clients_)
        {
            static_cast<void>(clientId);
            clients.push_back(std::move(stream));
        }
        clients_.clear();
    }
    for (const auto& stream : clients)
    {
        stream->close();
    }
}

void ReminderStreamService::addClient(drogon::ResponseStreamPtr stream)
{
    auto sharedStream = Stream(std::move(stream));
    if (!sharedStream->send("retry: 3000\nevent: heartbeat\ndata: {}\n\n"))
    {
        sharedStream->close();
        return;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    clients_.emplace(nextClientId_++, std::move(sharedStream));
}

void ReminderStreamService::broadcast(const models::ReminderDelivery& delivery)
{
    Json::StreamWriterBuilder writer;
    writer["indentation"] = "";
    writer["emitUTF8"] = true;

    std::ostringstream message;
    message << "id: " << delivery.id << '\n'
            << "event: reminder\n"
            << "data: " << Json::writeString(
                   writer,
                   http::reminderDeliveryToStreamJson(delivery))
            << "\n\n";
    sendToClients(message.str());
}

void ReminderStreamService::sendToClients(const std::string& message)
{
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto client = clients_.begin(); client != clients_.end();)
    {
        if (!client->second->send(message))
        {
            client->second->close();
            client = clients_.erase(client);
            continue;
        }
        ++client;
    }
}

void ReminderStreamService::sendHeartbeat()
{
    sendToClients("event: heartbeat\ndata: {}\n\n");
}

} // namespace voicecalendar::services
