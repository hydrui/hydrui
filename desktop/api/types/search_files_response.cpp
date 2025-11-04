#include "search_files_response.h"
#include "serialization.h"

namespace Hydrui::API {

void SearchFilesResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("version");
    writer.append(base.version);
    writer.append("hydrus_version");
    writer.append(base.hydrusVersion);
    writer.append("file_ids");
    writeIntArray(writer, fileIds);
    if (hashes.has_value()) {
        writer.append("hashes");
        writeStringArray(writer, *hashes);
    }
    writer.endMap();
}

std::expected<void, QCborError> SearchFilesResponse::readFromCbor(QCborStreamReader& reader) {
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
            } else if (key == "file_ids" && reader.isArray()) {
                readIntArray(reader, fileIds);
            } else if (key == "hashes" && reader.isArray()) {
                QVector<QString> hashVec;
                readStringArray(reader, hashVec);
                hashes = hashVec;
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject SearchFilesResponse::toJson() const {
    QJsonObject obj = base.toJson();
    obj["file_ids"] = intVectorToJson(fileIds);
    if (hashes.has_value()) {
        obj["hashes"] = stringListToJson(*hashes);
    }
    return obj;
}

void SearchFilesResponse::fromJson(const QJsonObject& json) {
    base.fromJson(json);
    fileIds = jsonToIntVector(json["file_ids"].toArray());
    if (json.contains("hashes")) {
        hashes = jsonToStringVector(json["hashes"].toArray());
    }
}

} // namespace Hydrui::API
