#include "config/BackendConfig.h"
#include "database/DatabaseManager.h"
#include "services/ReminderService.h"
#include "services/ReminderStreamService.h"

#include <drogon/drogon.h>

#include <memory>

int main()
{
    try
    {
        LOG_INFO << "VoiceCalendar Backend starting";
        const auto config = voicecalendar::config::BackendConfig::load();
        LOG_INFO << "Configuration loaded: reminderScanSeconds="
                 << config.reminderScanInterval.count();

        auto& databaseManager = voicecalendar::database::DatabaseManager::instance();
        databaseManager.initialize(config.databasePath, config.backendRoot);
        LOG_INFO << "Database initialized";

        auto reminderService = std::make_shared<voicecalendar::services::ReminderService>(
            config.reminderScanInterval);
        auto& application = drogon::app();
        application.registerBeginningAdvice([
            reminderService,
            host = config.host,
            port = config.port]() {
            voicecalendar::services::ReminderStreamService::instance().start(
                drogon::app().getLoop());
            reminderService->start(drogon::app().getLoop());
            LOG_INFO << "Backend ready: host=" << host << ", port=" << port;
        });
        application.addListener(config.host, config.port);
        application.run();
        reminderService->stop();
        voicecalendar::services::ReminderStreamService::instance().stop();
    }
    catch (const voicecalendar::config::ConfigError& error)
    {
        LOG_ERROR << "Backend configuration invalid: " << error.what();
        return 1;
    }
    catch (const std::exception& error)
    {
        LOG_ERROR << "Backend startup failed: " << error.what();
        return 1;
    }

    return 0;
}
