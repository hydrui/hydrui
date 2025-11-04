#include "file_metadata_response.h"
#include "serialization.h"
#include <QJsonArray>

namespace Hydrui::API {

void FileMetadataResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("version");
    writer.append(base.version);
    writer.append("hydrus_version");
    writer.append(base.hydrusVersion);
    if (services.has_value()) {
        writer.append("services");
        writer.startMap();
        // Services map would go here
        writer.endMap();
    }
    writer.append("metadata");
    writer.startArray(metadata.size());
    for (const auto& meta : metadata) {
        meta.writeToCbor(writer);
    }
    writer.endArray();
    writer.endMap();
}

std::expected<void, QCborError> FileMetadataResponse::readFromCbor(QCborStreamReader& reader) {
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
            } else if (key == "services" && reader.isMap()) {
                ServicesObject servicesMap;
                reader.enterContainer();
                for (;;) {
                    if (!reader.hasNext()) {
                        reader.leaveContainer();
                        break;
                    }
                    QString serviceKey = readCompleteString(reader);
                    Service service;
                    service.readFromCbor(reader);
                    servicesMap[serviceKey] = service;
                }
                services = servicesMap;
            } else if (key == "metadata" && reader.isArray()) {
                metadata.clear();
                reader.enterContainer();
                for (;;) {
                    if (!reader.hasNext()) {
                        reader.leaveContainer();
                        break;
                    }
                    FileMetadata meta;
                    meta.readFromCbor(reader);
                    metadata.append(meta);
                }
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject FileMetadataResponse::toJson() const {
    QJsonObject obj = base.toJson();
    if (services.has_value()) {
        QJsonObject servicesObj;
        for (auto it = services->begin(); it != services->end(); ++it) {
            servicesObj[it.key()] = it.value().toJson();
        }
        obj["services"] = servicesObj;
    }
    QJsonArray metaArray;
    for (const auto& meta : metadata) {
        metaArray.append(meta.toJson());
    }
    obj["metadata"] = metaArray;
    return obj;
}

void FileMetadataResponse::fromJson(const QJsonObject& json) {
    base.fromJson(json);
    if (json.contains("services")) {
        ServicesObject servicesMap;
        QJsonObject servicesObj = json["services"].toObject();
        for (auto it = servicesObj.begin(); it != servicesObj.end(); ++it) {
            Service service;
            service.fromJson(it.value().toObject());
            servicesMap[it.key()] = service;
        }
        services = servicesMap;
    }
    metadata.clear();
    QJsonArray metaArray = json["metadata"].toArray();
    for (const auto& val : metaArray) {
        FileMetadata meta;
        meta.fromJson(val.toObject());
        metadata.append(meta);
    }
}

} // namespace Hydrui::API
