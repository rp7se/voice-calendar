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
    src/controllers/HealthController.cpp
)

target_include_directories(voicecalendar_backend
  PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_link_libraries(voicecalendar_backend
  PRIVATE
    Drogon::Drogon
)
