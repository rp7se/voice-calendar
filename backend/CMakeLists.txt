cmake_minimum_required(VERSION 3.20)

project(voicecalendar_backend VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Drogon CONFIG REQUIRED)

add_executable(voicecalendar_backend)

target_sources(voicecalendar_backend
  PRIVATE
    src/main.cpp
    src/controllers/EventController.cpp
    src/controllers/CategoryController.cpp
    src/controllers/FreeTimeController.cpp
    src/controllers/HealthController.cpp
    src/controllers/ReminderController.cpp
    src/controllers/SchedulingController.cpp
    src/controllers/TaskController.cpp
    src/database/DatabaseManager.cpp
    src/http/EventJson.cpp
    src/http/CategoryJson.cpp
    src/http/TaskJson.cpp
    src/http/ReminderJson.cpp
    src/models/Event.cpp
    src/models/Category.cpp
    src/models/Task.cpp
    src/models/Reminder.cpp
    src/repositories/EventRepository.cpp
    src/repositories/CategoryRepository.cpp
    src/repositories/TaskRepository.cpp
    src/repositories/ReminderRepository.cpp
    src/services/EventConflictService.cpp
    src/services/FreeTimeService.cpp
    src/services/TaskSchedulerService.cpp
    src/services/ReminderService.cpp
    src/utils/DateTimeUtils.cpp
    src/utils/ReminderDateTime.cpp
)

target_include_directories(voicecalendar_backend
  PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_link_libraries(voicecalendar_backend
  PRIVATE
    Drogon::Drogon
)

enable_testing()

add_executable(reminder_datetime_tests
  tests/ReminderDateTimeTests.cpp
  src/utils/DateTimeUtils.cpp
  src/utils/ReminderDateTime.cpp
)

target_include_directories(reminder_datetime_tests
  PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

add_test(NAME reminder_datetime_tests COMMAND reminder_datetime_tests)
