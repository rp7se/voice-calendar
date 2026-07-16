#include "database/DatabaseManager.h"
#include "services/ReminderService.h"

#include <drogon/drogon.h>

#include <iostream>
#include <memory>

int main()
{
    try
    {
        auto& databaseManager = voicecalendar::database::DatabaseManager::instance();
        databaseManager.initialize();
    }
    catch (const std::exception& error)
    {
        std::cerr << "Database initialization failed: " << error.what() << '\n';
        return 1;
    }

    auto reminderService = std::make_shared<voicecalendar::services::ReminderService>();
    auto& application = drogon::app();
    application.registerBeginningAdvice([reminderService]() {
        reminderService->start(drogon::app().getLoop());
    });
    application.addListener("127.0.0.1", 8080).run();
    reminderService->stop();

    return 0;
}
