#include "tag_value.h"

namespace Hydrui::API {

QJsonObject TagValue::toJson() const {
    QJsonObject obj;
    obj["value"] = value;
    obj["count"] = count;
    return obj;
}

void TagValue::fromJson(const QJsonObject& json) {
    value = json["value"].toString();
    count = json["count"].toInt();
}

} // namespace Hydrui::API
