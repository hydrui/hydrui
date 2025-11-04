#include "get_file_relationships_response.h"
#include "serialization.h"

namespace Hydrui::API {

void GetFileRelationshipsResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("file_relationships");
    writer.startMap();
    for (auto it = fileRelationships.begin(); it != fileRelationships.end(); ++it) {
        writer.append(it.key());
        it.value().writeToCbor(writer);
    }
    writer.endMap();
    writer.endMap();
}

std::expected<void, QCborError> GetFileRelationshipsResponse::readFromCbor(QCborStreamReader& reader) {
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

            if (key == "file_relationships" && reader.isMap()) {
                fileRelationships.clear();
                reader.enterContainer();
                for (;;) {
                    if (!reader.hasNext()) {
                        reader.leaveContainer();
                        break;
                    }
                    QString relKey = readCompleteString(reader);
                    FileRelationshipInfo info;
                    info.readFromCbor(reader);
                    fileRelationships[relKey] = info;
                }
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject GetFileRelationshipsResponse::toJson() const {
    QJsonObject obj;
    QJsonObject relObj;
    for (auto it = fileRelationships.begin(); it != fileRelationships.end(); ++it) {
        relObj[it.key()] = it.value().toJson();
    }
    obj["file_relationships"] = relObj;
    return obj;
}

void GetFileRelationshipsResponse::fromJson(const QJsonObject& json) {
    fileRelationships.clear();
    QJsonObject relObj = json["file_relationships"].toObject();
    for (auto it = relObj.begin(); it != relObj.end(); ++it) {
        FileRelationshipInfo info;
        info.fromJson(it.value().toObject());
        fileRelationships[it.key()] = info;
    }
}

} // namespace Hydrui::API
