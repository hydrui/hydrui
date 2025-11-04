#include "file_metadata.h"
#include "serialization.h"
#include <QJsonArray>
#include <QJsonValue>

namespace Hydrui::API {

void FileMetadata::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("file_id");
    writer.append(fileId);
    writer.append("hash");
    writer.append(hash);

    if (size.has_value()) {
        writer.append("size");
        writer.append(*size);
    }
    if (mime.has_value()) {
        writer.append("mime");
        writer.append(*mime);
    }
    if (filetypeEnum.has_value()) {
        writer.append("filetype_enum");
        writer.append(*filetypeEnum);
    }
    if (width.has_value()) {
        writer.append("width");
        writer.append(*width);
    }
    if (height.has_value()) {
        writer.append("height");
        writer.append(*height);
    }
    if (duration.has_value()) {
        writer.append("duration");
        writer.append(*duration);
    }
    if (numFrames.has_value()) {
        writer.append("num_frames");
        writer.append(*numFrames);
    }
    if (hasAudio.has_value()) {
        writer.append("has_audio");
        writer.append(*hasAudio);
    }
    if (thumbnailWidth.has_value()) {
        writer.append("thumbnail_width");
        writer.append(*thumbnailWidth);
    }
    if (thumbnailHeight.has_value()) {
        writer.append("thumbnail_height");
        writer.append(*thumbnailHeight);
    }
    if (isInbox.has_value()) {
        writer.append("is_inbox");
        writer.append(*isInbox);
    }
    if (isLocal.has_value()) {
        writer.append("is_local");
        writer.append(*isLocal);
    }
    if (isTrashed.has_value()) {
        writer.append("is_trashed");
        writer.append(*isTrashed);
    }
    if (isDeleted.has_value()) {
        writer.append("is_deleted");
        writer.append(*isDeleted);
    }
    if (timeModified.has_value()) {
        writer.append("time_modified");
        writer.append(*timeModified);
    }
    if (knownUrls.has_value()) {
        writer.append("known_urls");
        writeStringArray(writer, *knownUrls);
    }

    writer.endMap();
}

void FileMetadata::readFromCbor(QCborStreamReader& reader) {
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
        if (key == "file_id" && reader.isInteger()) {
            fileId = reader.toInteger();
        } else if (key == "hash" && reader.isString()) {
            hash = readCompleteString(reader);
        } else if (key == "size" && reader.isInteger()) {
            size = reader.toInteger();
        } else if (key == "mime" && reader.isString()) {
            mime = readCompleteString(reader);
        } else if (key == "width" && reader.isInteger()) {
            width = reader.toInteger();
        } else if (key == "height" && reader.isInteger()) {
            height = reader.toInteger();
        } else {
            reader.next();
        }
    }
}

QJsonObject FileMetadata::toJson() const {
    QJsonObject obj;
    obj["file_id"] = fileId;
    obj["hash"] = hash;

    if (size.has_value())
        obj["size"] = static_cast<qint64>(*size);
    if (mime.has_value())
        obj["mime"] = *mime;
    if (filetypeEnum.has_value())
        obj["filetype_enum"] = *filetypeEnum;
    if (width.has_value())
        obj["width"] = *width;
    if (height.has_value())
        obj["height"] = *height;
    if (duration.has_value())
        obj["duration"] = *duration;
    if (numFrames.has_value())
        obj["num_frames"] = *numFrames;
    if (hasAudio.has_value())
        obj["has_audio"] = *hasAudio;
    if (thumbnailWidth.has_value())
        obj["thumbnail_width"] = *thumbnailWidth;
    if (thumbnailHeight.has_value())
        obj["thumbnail_height"] = *thumbnailHeight;
    if (isInbox.has_value())
        obj["is_inbox"] = *isInbox;
    if (isLocal.has_value())
        obj["is_local"] = *isLocal;
    if (isTrashed.has_value())
        obj["is_trashed"] = *isTrashed;
    if (isDeleted.has_value())
        obj["is_deleted"] = *isDeleted;
    if (timeModified.has_value())
        obj["time_modified"] = static_cast<qint64>(*timeModified);
    if (knownUrls.has_value())
        obj["known_urls"] = stringListToJson(*knownUrls);

    if (tags.has_value()) {
        QJsonObject tagsObj;
        for (auto it = tags->begin(); it != tags->end(); ++it) {
            tagsObj[it.key()] = it.value().toJson();
        }
        obj["tags"] = tagsObj;
    }

    if (ratings.has_value()) {
        QJsonObject ratingsObj;
        for (auto it = ratings->begin(); it != ratings->end(); ++it) {
            ratingsObj[it.key()] = QJsonValue::fromVariant(it.value());
        }
        obj["ratings"] = ratingsObj;
    }

    if (notes.has_value()) {
        QJsonObject notesObj;
        for (auto it = notes->begin(); it != notes->end(); ++it) {
            notesObj[it.key()] = it.value();
        }
        obj["notes"] = notesObj;
    }

    return obj;
}

void FileMetadata::fromJson(const QJsonObject& json) {
    fileId = json["file_id"].toInt();
    hash = json["hash"].toString();

    if (json.contains("size"))
        size = json["size"].toInteger();
    if (json.contains("mime"))
        mime = json["mime"].toString();
    if (json.contains("filetype_enum"))
        filetypeEnum = json["filetype_enum"].toInt();
    if (json.contains("width"))
        width = json["width"].toInt();
    if (json.contains("height"))
        height = json["height"].toInt();
    if (json.contains("duration"))
        duration = json["duration"].toInt();
    if (json.contains("num_frames"))
        numFrames = json["num_frames"].toInt();
    if (json.contains("has_audio"))
        hasAudio = json["has_audio"].toBool();
    if (json.contains("thumbnail_width"))
        thumbnailWidth = json["thumbnail_width"].toInt();
    if (json.contains("thumbnail_height"))
        thumbnailHeight = json["thumbnail_height"].toInt();
    if (json.contains("is_inbox"))
        isInbox = json["is_inbox"].toBool();
    if (json.contains("is_local"))
        isLocal = json["is_local"].toBool();
    if (json.contains("is_trashed"))
        isTrashed = json["is_trashed"].toBool();
    if (json.contains("is_deleted"))
        isDeleted = json["is_deleted"].toBool();
    if (json.contains("time_modified"))
        timeModified = json["time_modified"].toInteger();
    if (json.contains("known_urls")) {
        knownUrls = jsonToStringVector(json["known_urls"].toArray());
    }

    if (json.contains("tags")) {
        QMap<QString, TagsObject> tagsMap;
        QJsonObject tagsObj = json["tags"].toObject();
        for (auto it = tagsObj.begin(); it != tagsObj.end(); ++it) {
            TagsObject tagObj;
            tagObj.fromJson(it.value().toObject());
            tagsMap[it.key()] = tagObj;
        }
        tags = tagsMap;
    }

    if (json.contains("ratings")) {
        QMap<QString, QVariant> ratingsMap;
        QJsonObject ratingsObj = json["ratings"].toObject();
        for (auto it = ratingsObj.begin(); it != ratingsObj.end(); ++it) {
            ratingsMap[it.key()] = it.value().toVariant();
        }
        ratings = ratingsMap;
    }

    if (json.contains("notes")) {
        QMap<QString, QString> notesMap;
        QJsonObject notesObj = json["notes"].toObject();
        for (auto it = notesObj.begin(); it != notesObj.end(); ++it) {
            notesMap[it.key()] = it.value().toString();
        }
        notes = notesMap;
    }
}

} // namespace Hydrui::API
