#include "file_domain_param.h"
#include "serialization.h"
#include <QJsonDocument>

namespace Hydrui::API {

QUrlQuery FileDomainParam::toUrlQuery() const {
    QUrlQuery query;
    if (fileServiceKey.has_value()) {
        query.addQueryItem("file_service_key", *fileServiceKey);
    }
    if (fileServiceKeys.has_value()) {
        query.addQueryItem("file_service_keys",
                           QJsonDocument(stringListToJson(*fileServiceKeys)).toJson(QJsonDocument::Compact));
    }
    if (deletedFileServiceKey.has_value()) {
        query.addQueryItem("deleted_file_service_key", *deletedFileServiceKey);
    }
    if (deletedFileServiceKeys.has_value()) {
        query.addQueryItem("deleted_file_service_keys",
                           QJsonDocument(stringListToJson(*deletedFileServiceKeys)).toJson(QJsonDocument::Compact));
    }
    return query;
}

void FileDomainParam::fromUrlQuery(const QUrlQuery& query) {
    if (query.hasQueryItem("file_service_key")) {
        fileServiceKey = query.queryItemValue("file_service_key");
    }
    if (query.hasQueryItem("file_service_keys")) {
        auto doc = QJsonDocument::fromJson(query.queryItemValue("file_service_keys").toUtf8());
        fileServiceKeys = jsonToStringVector(doc.array());
    }
    if (query.hasQueryItem("deleted_file_service_key")) {
        deletedFileServiceKey = query.queryItemValue("deleted_file_service_key");
    }
    if (query.hasQueryItem("deleted_file_service_keys")) {
        auto doc = QJsonDocument::fromJson(query.queryItemValue("deleted_file_service_keys").toUtf8());
        deletedFileServiceKeys = jsonToStringVector(doc.array());
    }
}

QJsonObject FileDomainParam::toJson() const {
    QJsonObject obj;
    if (fileServiceKey.has_value())
        obj["file_service_key"] = *fileServiceKey;
    if (fileServiceKeys.has_value())
        obj["file_service_keys"] = stringListToJson(*fileServiceKeys);
    if (deletedFileServiceKey.has_value())
        obj["deleted_file_service_key"] = *deletedFileServiceKey;
    if (deletedFileServiceKeys.has_value())
        obj["deleted_file_service_keys"] = stringListToJson(*deletedFileServiceKeys);
    return obj;
}

void FileDomainParam::fromJson(const QJsonObject& json) {
    if (json.contains("file_service_key"))
        fileServiceKey = json["file_service_key"].toString();
    if (json.contains("file_service_keys"))
        fileServiceKeys = jsonToStringVector(json["file_service_keys"].toArray());
    if (json.contains("deleted_file_service_key"))
        deletedFileServiceKey = json["deleted_file_service_key"].toString();
    if (json.contains("deleted_file_service_keys"))
        deletedFileServiceKeys = jsonToStringVector(json["deleted_file_service_keys"].toArray());
}

} // namespace Hydrui::API
