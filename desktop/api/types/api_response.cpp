#include "api_response.h"

namespace Hydrui::API {

QJsonObject ApiResponse::toJson() const {
    QJsonObject obj;
    obj["version"] = version;
    obj["hydrus_version"] = hydrusVersion;
    return obj;
}

void ApiResponse::fromJson(const QJsonObject& json) {
    version = json["version"].toInt();
    hydrusVersion = json["hydrus_version"].toInt();
}

} // namespace Hydrui::API
