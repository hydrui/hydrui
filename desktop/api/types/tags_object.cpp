#include "tags_object.h"
#include "serialization.h"

namespace Hydrui::API {

QJsonObject TagsObject::toJson() const {
    QJsonObject obj;

    QJsonObject storageObj;
    for (auto it = storageTags.begin(); it != storageTags.end(); ++it) {
        storageObj[it.key()] = stringListToJson(it.value());
    }
    obj["storage_tags"] = storageObj;

    QJsonObject displayObj;
    for (auto it = displayTags.begin(); it != displayTags.end(); ++it) {
        displayObj[it.key()] = stringListToJson(it.value());
    }
    obj["display_tags"] = displayObj;

    return obj;
}

void TagsObject::fromJson(const QJsonObject& json) {
    storageTags.clear();
    displayTags.clear();

    QJsonObject storageObj = json["storage_tags"].toObject();
    for (auto it = storageObj.begin(); it != storageObj.end(); ++it) {
        storageTags[it.key()] = jsonToStringVector(it.value().toArray());
    }

    QJsonObject displayObj = json["display_tags"].toObject();
    for (auto it = displayObj.begin(); it != displayObj.end(); ++it) {
        displayTags[it.key()] = jsonToStringVector(it.value().toArray());
    }
}

} // namespace Hydrui::API
