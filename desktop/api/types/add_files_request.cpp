#include "add_files_request.h"
#include "serialization.h"

namespace Hydrui::API {

void AddFilesRequest::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    if (fileIds.has_value()) {
        writer.append("file_ids");
        writeIntArray(writer, *fileIds);
    }
    if (hashes.has_value()) {
        writer.append("hashes");
        writeStringArray(writer, *hashes);
    }
    writer.append("page_key");
    writer.append(pageKey);
    writer.endMap();
}

std::expected<void, QCborError> AddFilesRequest::readFromCbor(QCborStreamReader& reader) {
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
            if (key == "file_ids" && reader.isArray()) {
                QVector<int> ids;
                readIntArray(reader, ids);
                fileIds = ids;
            } else if (key == "hashes" && reader.isArray()) {
                QVector<QString> hashVec;
                readStringArray(reader, hashVec);
                hashes = hashVec;
            } else if (key == "page_key" && reader.isString()) {
                pageKey = readCompleteString(reader);
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject AddFilesRequest::toJson() const {
    QJsonObject obj;
    if (fileIds.has_value()) {
        obj["file_ids"] = intVectorToJson(*fileIds);
    }
    if (hashes.has_value()) {
        obj["hashes"] = stringListToJson(*hashes);
    }
    obj["page_key"] = pageKey;
    return obj;
}

void AddFilesRequest::fromJson(const QJsonObject& json) {
    if (json.contains("file_ids")) {
        fileIds = jsonToIntVector(json["file_ids"].toArray());
    }
    if (json.contains("hashes")) {
        hashes = jsonToStringVector(json["hashes"].toArray());
    }
    pageKey = json["page_key"].toString();
}

} // namespace Hydrui::API
