#include "search_files_params.h"
#include "serialization.h"
#include <QJsonDocument>

namespace Hydrui::API {

QUrlQuery SearchFilesParams::toUrlQuery() const {
    QUrlQuery query = domain.toUrlQuery();
    query.addQueryItem("tags", QJsonDocument(stringListToJson(tags)).toJson(QJsonDocument::Compact));
    if (tagServiceKey.has_value()) {
        query.addQueryItem("tag_service_key", *tagServiceKey);
    }
    if (includeCurrentTags.has_value()) {
        query.addQueryItem("include_current_tags", *includeCurrentTags ? "true" : "false");
    }
    if (includePendingTags.has_value()) {
        query.addQueryItem("include_pending_tags", *includePendingTags ? "true" : "false");
    }
    if (fileSortType.has_value()) {
        query.addQueryItem("file_sort_type", QString::number(*fileSortType));
    }
    if (fileSortAsc.has_value()) {
        query.addQueryItem("file_sort_asc", *fileSortAsc ? "true" : "false");
    }
    if (returnFileIds.has_value()) {
        query.addQueryItem("return_file_ids", *returnFileIds ? "true" : "false");
    }
    if (returnHashes.has_value()) {
        query.addQueryItem("return_hashes", *returnHashes ? "true" : "false");
    }
    return query;
}

void SearchFilesParams::fromUrlQuery(const QUrlQuery& query) {
    domain.fromUrlQuery(query);
    if (query.hasQueryItem("tags")) {
        auto doc = QJsonDocument::fromJson(query.queryItemValue("tags").toUtf8());
        tags = jsonToStringVector(doc.array());
    }
    if (query.hasQueryItem("tag_service_key")) {
        tagServiceKey = query.queryItemValue("tag_service_key");
    }
    if (query.hasQueryItem("include_current_tags")) {
        includeCurrentTags = query.queryItemValue("include_current_tags") == "true";
    }
    if (query.hasQueryItem("include_pending_tags")) {
        includePendingTags = query.queryItemValue("include_pending_tags") == "true";
    }
    if (query.hasQueryItem("file_sort_type")) {
        fileSortType = query.queryItemValue("file_sort_type").toInt();
    }
    if (query.hasQueryItem("file_sort_asc")) {
        fileSortAsc = query.queryItemValue("file_sort_asc") == "true";
    }
    if (query.hasQueryItem("return_file_ids")) {
        returnFileIds = query.queryItemValue("return_file_ids") == "true";
    }
    if (query.hasQueryItem("return_hashes")) {
        returnHashes = query.queryItemValue("return_hashes") == "true";
    }
}

} // namespace Hydrui::API
