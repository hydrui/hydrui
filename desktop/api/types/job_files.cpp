#include "job_files.h"
#include "serialization.h"

namespace Hydrui::API {

QJsonObject JobFiles::toJson() const {
    QJsonObject obj;
    obj["hashes"] = stringListToJson(hashes);
    if (label.has_value()) {
        obj["label"] = *label;
    }
    return obj;
}

void JobFiles::fromJson(const QJsonObject& json) {
    hashes = jsonToStringVector(json["hashes"].toArray());
    if (json.contains("label")) {
        label = json["label"].toString();
    }
}

} // namespace Hydrui::API
