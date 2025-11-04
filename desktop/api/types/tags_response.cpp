#include "tags_response.h"
#include "serialization.h"
#include <QJsonArray>

namespace Hydrui::API {

void TagsResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("version");
    writer.append(base.version);
    writer.append("hydrus_version");
    writer.append(base.hydrusVersion);
    writer.append("tags");
    writer.startArray(tags.size());
    for (const auto& tag : tags) {
        writer.startMap(2);
        writer.append("value");
        writer.append(tag.value);
        writer.append("count");
        writer.append(tag.count);
        writer.endMap();
    }
    writer.endArray();
    writer.endMap();
}

std::expected<void, QCborError> TagsResponse::readFromCbor(QCborStreamReader& reader) {
    try {
        if (!reader.isMap()) {
            return {};
        }
        reader.enterContainer();
        for (;;) {
            if (!reader.hasNext()) {
                reader.leaveContainer();
                return {};
            }
            QString key = readCompleteString(reader);
            if (key == "version" && reader.isInteger()) {
                base.version = reader.toInteger();
            } else if (key == "hydrus_version" && reader.isInteger()) {
                base.hydrusVersion = reader.toInteger();
            } else if (key == "tags" && reader.isArray()) {
                tags.clear();
                reader.enterContainer();
                for (;;) {
                    if (!reader.hasNext()) {
                        reader.leaveContainer();
                        break;
                    }
                    TagValue tag;
                    if (reader.isMap()) {
                        reader.enterContainer();
                        for (;;) {
                            if (!reader.hasNext()) {
                                reader.leaveContainer();
                                break;
                            }
                            QString tagKey = readCompleteString(reader);
                            if (tagKey == "value" && reader.isString()) {
                                tag.value = readCompleteString(reader);
                            } else if (tagKey == "count" && reader.isInteger()) {
                                tag.count = reader.toInteger();
                            } else {
                                reader.next();
                            }
                        }
                    }
                    tags.append(tag);
                }
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject TagsResponse::toJson() const {
    QJsonObject obj = base.toJson();
    QJsonArray tagsArray;
    for (const auto& tag : tags) {
        tagsArray.append(tag.toJson());
    }
    obj["tags"] = tagsArray;
    return obj;
}

void TagsResponse::fromJson(const QJsonObject& json) {
    base.fromJson(json);
    tags.clear();
    QJsonArray tagsArray = json["tags"].toArray();
    for (const auto& val : tagsArray) {
        TagValue tag;
        tag.fromJson(val.toObject());
        tags.append(tag);
    }
}

} // namespace Hydrui::API
