#include "files_param.h"
#include "serialization.h"
#include <QJsonDocument>
#include <QJsonObject>

namespace Hydrui::API {

bool FilesParam::readCborKeyValuePair(QCborStreamReader& reader, QString key) {
    if (key == "file_id" && reader.isInteger()) {
        fileId = reader.toInteger();
    } else if (key == "file_ids" && reader.isArray()) {
        QVector<int> ids;
        readIntArray(reader, ids);
        fileIds = ids;
    } else if (key == "hash" && reader.isString()) {
        hash = readCompleteString(reader);
    } else if (key == "hashes" && reader.isArray()) {
        QVector<QString> hashVec;
        readStringArray(reader, hashVec);
        hashes = hashVec;
    } else {
        return false;
    }
    return true;
}

void FilesParam::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    if (fileId.has_value()) {
        writer.append("file_id");
        writer.append(*fileId);
    }
    if (fileIds.has_value()) {
        writer.append("file_ids");
        writeIntArray(writer, *fileIds);
    }
    if (hash.has_value()) {
        writer.append("hash");
        writer.append(*hash);
    }
    if (hashes.has_value()) {
        writer.append("hashes");
        writeStringArray(writer, *hashes);
    }
    writer.endMap();
}

void FilesParam::readFromCbor(QCborStreamReader& reader) {
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
        if (!readCborKeyValuePair(reader, key)) {
            reader.next();
        }
    }
    reader.leaveContainer();
}

QJsonObject FilesParam::toJson() const {
    QJsonObject obj;
    if (fileId.has_value())
        obj["file_id"] = *fileId;
    if (fileIds.has_value())
        obj["file_ids"] = intVectorToJson(*fileIds);
    if (hash.has_value())
        obj["hash"] = *hash;
    if (hashes.has_value())
        obj["hashes"] = stringListToJson(*hashes);
    return obj;
}

void FilesParam::fromJson(const QJsonObject& json) {
    if (json.contains("file_id"))
        fileId = json["file_id"].toInt();
    if (json.contains("file_ids"))
        fileIds = jsonToIntVector(json["file_ids"].toArray());
    if (json.contains("hash"))
        hash = json["hash"].toString();
    if (json.contains("hashes"))
        hashes = jsonToStringVector(json["hashes"].toArray());
}

QUrlQuery FilesParam::toUrlQuery() const {
    QUrlQuery query;
    if (fileId.has_value()) {
        query.addQueryItem("file_id", QString::number(*fileId));
    }
    if (fileIds.has_value()) {
        query.addQueryItem("file_ids", QJsonDocument(intVectorToJson(*fileIds)).toJson(QJsonDocument::Compact));
    }
    if (hash.has_value()) {
        query.addQueryItem("hash", *hash);
    }
    if (hashes.has_value()) {
        query.addQueryItem("hashes", QJsonDocument(stringListToJson(*hashes)).toJson(QJsonDocument::Compact));
    }
    return query;
}

void FilesParam::fromUrlQuery(const QUrlQuery& query) {
    if (query.hasQueryItem("file_id")) {
        fileId = query.queryItemValue("file_id").toInt();
    }
    if (query.hasQueryItem("file_ids")) {
        auto doc = QJsonDocument::fromJson(query.queryItemValue("file_ids").toUtf8());
        fileIds = jsonToIntVector(doc.array());
    }
    if (query.hasQueryItem("hash")) {
        hash = query.queryItemValue("hash");
    }
    if (query.hasQueryItem("hashes")) {
        auto doc = QJsonDocument::fromJson(query.queryItemValue("hashes").toUtf8());
        hashes = jsonToStringVector(doc.array());
    }
}

} // namespace Hydrui::API
