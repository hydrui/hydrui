#include "page_info.h"
#include "serialization.h"
#include <QJsonObject>

namespace Hydrui::API {

QJsonObject PageInfo::toJson() const {
    QJsonObject obj;
    obj["name"] = name;
    obj["page_key"] = pageKey;
    obj["page_state"] = pageState;
    obj["page_type"] = pageType;
    obj["is_media_page"] = isMediaPage;
    if (management.has_value()) {
        obj["management"] = QJsonObject::fromVariantMap(*management);
    }
    if (media.has_value()) {
        obj["media"] = media->toJson();
    }
    return obj;
}

void PageInfo::fromJson(const QJsonObject& json) {
    name = json["name"].toString();
    pageKey = json["page_key"].toString();
    pageState = json["page_state"].toInt();
    pageType = json["page_type"].toInt();
    isMediaPage = json["is_media_page"].toBool();
    if (json.contains("management")) {
        management = json["management"].toObject().toVariantMap();
    }
    if (json.contains("media")) {
        MediaInfo mediaInfo;
        mediaInfo.fromJson(json["media"].toObject());
        media = mediaInfo;
    }
}

void PageInfo::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("name");
    writer.append(name);
    writer.append("page_key");
    writer.append(pageKey);
    writer.append("page_state");
    writer.append(pageState);
    writer.append("page_type");
    writer.append(pageType);
    writer.append("is_media_page");
    writer.append(isMediaPage);

    if (management.has_value()) {
        // TODO: Serialize management map
    }

    if (media.has_value()) {
        writer.append("media");
        writer.startMap(2);
        writer.append("num_files");
        writer.append(media->numFiles);
        writer.append("hash_ids");
        writeIntArray(writer, media->hashIds);
        writer.endMap();
    }

    writer.endMap();
}

void PageInfo::readFromCbor(QCborStreamReader& reader) {
    if (!reader.isMap()) {
        return;
    }
    reader.enterContainer();
    for (;;) {
        if (!reader.hasNext()) {
            reader.leaveContainer();
            return;
        }
        QString key = readCompleteString(reader);

        if (key == "name" && reader.isString()) {
            name = readCompleteString(reader);
        } else if (key == "page_key" && reader.isString()) {
            pageKey = readCompleteString(reader);
        } else if (key == "page_state" && reader.isInteger()) {
            pageState = reader.toInteger();
        } else if (key == "page_type" && reader.isInteger()) {
            pageType = reader.toInteger();
        } else if (key == "is_media_page" && reader.isBool()) {
            isMediaPage = reader.toBool();
        } else if (key == "management" && reader.isMap()) {
            // TODO: Deserialize management map
            reader.next();
        } else if (key == "media" && reader.isMap()) {
            MediaInfo mediaInfo;
            reader.enterContainer();
            for (;;) {
                if (!reader.hasNext()) {
                    reader.leaveContainer();
                    break;
                }
                QString mediaKey = readCompleteString(reader);

                if (mediaKey == "num_files" && reader.isInteger()) {
                    mediaInfo.numFiles = reader.toInteger();
                } else if (mediaKey == "hash_ids" && reader.isArray()) {
                    readIntArray(reader, mediaInfo.hashIds);
                } else {
                    reader.next();
                }
            }
            media = mediaInfo;
        } else {
            reader.next();
        }
    }
}

} // namespace Hydrui::API
