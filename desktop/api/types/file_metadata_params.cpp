#include "file_metadata_params.h"

namespace Hydrui::API {

QUrlQuery FileMetadataParams::toUrlQuery() const {
    QUrlQuery query = files.toUrlQuery();
    if (createNewFileIds.has_value()) {
        query.addQueryItem("create_new_file_ids", *createNewFileIds ? "true" : "false");
    }
    if (onlyReturnIdentifiers.has_value()) {
        query.addQueryItem("only_return_identifiers", *onlyReturnIdentifiers ? "true" : "false");
    }
    if (onlyReturnBasicInformation.has_value()) {
        query.addQueryItem("only_return_basic_information", *onlyReturnBasicInformation ? "true" : "false");
    }
    if (detailedUrlInformation.has_value()) {
        query.addQueryItem("detailed_url_information", *detailedUrlInformation ? "true" : "false");
    }
    if (includeBlurhash.has_value()) {
        query.addQueryItem("include_blurhash", *includeBlurhash ? "true" : "false");
    }
    if (includeMilliseconds.has_value()) {
        query.addQueryItem("include_milliseconds", *includeMilliseconds ? "true" : "false");
    }
    if (includeNotes.has_value()) {
        query.addQueryItem("include_notes", *includeNotes ? "true" : "false");
    }
    if (includeServicesObject.has_value()) {
        query.addQueryItem("include_services_object", *includeServicesObject ? "true" : "false");
    }
    return query;
}

void FileMetadataParams::fromUrlQuery(const QUrlQuery& query) {
    files.fromUrlQuery(query);
    if (query.hasQueryItem("create_new_file_ids")) {
        createNewFileIds = query.queryItemValue("create_new_file_ids") == "true";
    }
    if (query.hasQueryItem("only_return_identifiers")) {
        onlyReturnIdentifiers = query.queryItemValue("only_return_identifiers") == "true";
    }
    if (query.hasQueryItem("only_return_basic_information")) {
        onlyReturnBasicInformation = query.queryItemValue("only_return_basic_information") == "true";
    }
    if (query.hasQueryItem("detailed_url_information")) {
        detailedUrlInformation = query.queryItemValue("detailed_url_information") == "true";
    }
    if (query.hasQueryItem("include_blurhash")) {
        includeBlurhash = query.queryItemValue("include_blurhash") == "true";
    }
    if (query.hasQueryItem("include_milliseconds")) {
        includeMilliseconds = query.queryItemValue("include_milliseconds") == "true";
    }
    if (query.hasQueryItem("include_notes")) {
        includeNotes = query.queryItemValue("include_notes") == "true";
    }
    if (query.hasQueryItem("include_services_object")) {
        includeServicesObject = query.queryItemValue("include_services_object") == "true";
    }
}

} // namespace Hydrui::API
