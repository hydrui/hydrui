#include "media_info.h"
#include "serialization.h"

namespace Hydrui::API {

QJsonObject MediaInfo::toJson() const {
    QJsonObject obj;
    obj["num_files"] = numFiles;
    obj["hash_ids"] = intVectorToJson(hashIds);
    return obj;
}

void MediaInfo::fromJson(const QJsonObject& json) {
    numFiles = json["num_files"].toInt();
    hashIds = jsonToIntVector(json["hash_ids"].toArray());
}

} // namespace Hydrui::API
