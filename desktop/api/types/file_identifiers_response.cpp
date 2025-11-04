#include "file_identifiers_response.h"
#include "serialization.h"

namespace Hydrui::API {

void FileIdentifiersResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("version");
    writer.append(base.version);
    writer.append("hydrus_version");
    writer.append(base.hydrusVersion);
    writer.append("services");
    writer.startMap();
    writer.endMap();
    writer.append("metadata");
    writer.startArray(metadata.size());
    for (const auto& ident : metadata) {
        ident.writeToCbor(writer);
    }
    writer.endArray();
    writer.endMap();
}

std::expected<void, QCborError> FileIdentifiersResponse::readFromCbor(QCborStreamReader& reader) {
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
                reader.enterContainer();
                for (;;) {
                    if (!reader.hasNext()) {
                        reader.leaveContainer();
                        break;
                    }
                    QString serviceKey = readCompleteString(reader);
                    Service service;
                    service.readFromCbor(reader);
                    services[serviceKey] = service;
                }
            } else if (key == "metadata" && reader.isArray()) {
                metadata.clear();
                reader.enterContainer();
                for (;;) {
                    if (!reader.hasNext()) {
                        reader.leaveContainer();
                        break;
                    }
                    FileIdentifier ident;
                    ident.readFromCbor(reader);
                    metadata.append(ident);
                }
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject FileIdentifiersResponse::toJson() const {
    QJsonObject obj = base.toJson();
    QJsonObject servicesObj;
    for (auto it = services.begin(); it != services.end(); ++it) {
        servicesObj[it.key()] = it.value().toJson();
    }
    obj["services"] = servicesObj;
    QJsonArray metaArray;
    for (const auto& ident : metadata) {
        metaArray.append(ident.toJson());
    }
    obj["metadata"] = metaArray;
    return obj;
}

void FileIdentifiersResponse::fromJson(const QJsonObject& json) {
    base.fromJson(json);
    services.clear();
    QJsonObject servicesObj = json["services"].toObject();
    for (auto it = servicesObj.begin(); it != servicesObj.end(); ++it) {
        Service service;
        service.fromJson(it.value().toObject());
        services[it.key()] = service;
    }
    metadata.clear();
    QJsonArray metaArray = json["metadata"].toArray();
    for (const auto& val : metaArray) {
        FileIdentifier ident;
        ident.fromJson(val.toObject());
        metadata.append(ident);
    }
}

} // namespace Hydrui::API
