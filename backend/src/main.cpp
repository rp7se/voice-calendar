#include "database/DatabaseManager.h"

#include <drogon/drogon.h>

#include <iostream>

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

    drogon::app()
        .addListener("127.0.0.1", 8080)
        .run();

    return 0;
}
