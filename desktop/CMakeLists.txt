cmake_minimum_required(VERSION 3.24)
project(hydrui-desktop VERSION 0.8.1 LANGUAGES CXX)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
    # Only set C++ standard when not being embedded
    set(CMAKE_CXX_STANDARD 23)
    set(CMAKE_CXX_STANDARD_REQUIRED ON)

    # Set up compile_commands.json automatically when standalone.
    option(HYDRUI_SETUP_COMPILE_COMMANDS "Set up compile_commands.json" ON)
    if(HYDRUI_SETUP_COMPILE_COMMANDS)
        set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
        execute_process(
            COMMAND ${CMAKE_COMMAND} -E create_symlink
                    ${CMAKE_CURRENT_BINARY_DIR}/compile_commands.json
                    ${CMAKE_CURRENT_SOURCE_DIR}/compile_commands.json
            COMMAND echo ""
            COMMAND_ERROR_IS_FATAL LAST
        )
    endif()
endif()

find_package(Qt6 REQUIRED COMPONENTS Core Widgets Test)
find_package(QCoro6 REQUIRED COMPONENTS Core Network Test)

# Enable testing
enable_testing()

add_library(hydrui-api-types STATIC
    api/types/interfaces.h
    api/types/serialization.h
    api/types/serialization.cpp
    api/types/api_response.h
    api/types/api_response.cpp
    api/types/service.h
    api/types/service.cpp
    api/types/services_response.h
    api/types/services_response.cpp
    api/types/tags_object.h
    api/types/tags_object.cpp
    api/types/tag_value.h
    api/types/tag_value.cpp
    api/types/files_param.h
    api/types/files_param.cpp
    api/types/file_domain_param.h
    api/types/file_domain_param.cpp
    api/types/file_identifier.h
    api/types/file_identifier.cpp
    api/types/file_metadata.h
    api/types/file_metadata.cpp
    api/types/file_identifiers_response.h
    api/types/file_identifiers_response.cpp
    api/types/file_metadata_response.h
    api/types/file_metadata_response.cpp
    api/types/search_files_response.h
    api/types/search_files_response.cpp
    api/types/page.h
    api/types/page.cpp
    api/types/page_response.h
    api/types/page_response.cpp
    api/types/media_info.h
    api/types/media_info.cpp
    api/types/page_info.h
    api/types/page_info.cpp
    api/types/page_info_response.h
    api/types/page_info_response.cpp
    api/types/job_files.h
    api/types/job_files.cpp
    api/types/job_status.h
    api/types/job_status.cpp
    api/types/popups_response.h
    api/types/popups_response.cpp
    api/types/file_relationship_info.h
    api/types/file_relationship_info.cpp
    api/types/file_relationship_pair.h
    api/types/file_relationship_pair.cpp
    api/types/get_file_relationships_response.h
    api/types/get_file_relationships_response.cpp
    api/types/add_file_response.h
    api/types/add_file_response.cpp
    api/types/add_url_response.h
    api/types/add_url_response.cpp
    api/types/add_notes_response.h
    api/types/add_notes_response.cpp
    api/types/tags_response.h
    api/types/tags_response.cpp
    api/types/verify_access_key_response.h
    api/types/verify_access_key_response.cpp
    api/types/add_files_request.h
    api/types/add_files_request.cpp
    api/types/refresh_page_request.h
    api/types/refresh_page_request.cpp
    api/types/associate_url_request.h
    api/types/associate_url_request.cpp
    api/types/dismiss_popup_request.h
    api/types/dismiss_popup_request.cpp
    api/types/add_tags_request.h
    api/types/add_tags_request.cpp
    api/types/add_url_request.h
    api/types/add_url_request.cpp
    api/types/set_file_relationships_request.h
    api/types/set_file_relationships_request.cpp
    api/types/set_kings_request.h
    api/types/set_kings_request.cpp
    api/types/set_rating_request.h
    api/types/set_rating_request.cpp
    api/types/add_notes_request.h
    api/types/add_notes_request.cpp
    api/types/delete_notes_request.h
    api/types/delete_notes_request.cpp
    api/types/search_files_params.h
    api/types/search_files_params.cpp
    api/types/file_metadata_params.h
    api/types/file_metadata_params.cpp
    api/types/page_info_params.h
    api/types/page_info_params.cpp
    api/types/tags_search_params.h
    api/types/tags_search_params.cpp
    api/types/get_file_relationships_params.h
    api/types/get_file_relationships_params.cpp
)

target_link_libraries(hydrui-api-types
    Qt6::Core
    QCoro::Coro
    QCoro::Core
)

add_executable(hydrui-desktop
    main.cpp
)

target_link_libraries(hydrui-desktop
    Qt6::Core
    Qt6::Widgets
    hydrui-api-types
)

install(TARGETS hydrui-desktop
    RUNTIME DESTINATION bin
)

# Tests
add_executable(api_types_add_file_response_test api/types/add_file_response_test.cpp)
target_link_libraries(api_types_add_file_response_test Qt6::Test QCoro::Test hydrui-api-types)
add_executable(api_types_service_test api/types/service_test.cpp)
target_link_libraries(api_types_service_test Qt6::Test QCoro::Test hydrui-api-types)
add_executable(api_types_verify_access_key_response_test api/types/verify_access_key_response_test.cpp)
target_link_libraries(api_types_verify_access_key_response_test Qt6::Test QCoro::Test hydrui-api-types)

add_test(NAME AddFileResponseTest COMMAND api_types_add_file_response_test)
add_test(NAME ServiceTest COMMAND api_types_service_test)
add_test(NAME VerifyAccessKeyResponseTest COMMAND api_types_verify_access_key_response_test)
