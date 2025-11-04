#include "services_response.h"
#include "serialization.h"

namespace Hydrui::API {

void ServicesResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap(3);
    writer.append("version");
    writer.append(base.version);
    writer.append("hydrus_version");
    writer.append(base.hydrusVersion);
    writer.append("services");
    writer.startMap(services.size());
    for (auto it = services.begin(); it != services.end(); ++it) {
        writer.append(it.key());
        it.value().writeToCbor(writer);
    }
    writer.endMap();
    writer.endMap();
}

std::expected<void, QCborError> ServicesResponse::readFromCbor(QCborStreamReader& reader) {
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
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject ServicesResponse::toJson() const {
    QJsonObject obj = base.toJson();
    QJsonObject servicesObj;
    for (auto it = services.begin(); it != services.end(); ++it) {
        servicesObj[it.key()] = it.value().toJson();
    }
    obj["services"] = servicesObj;
    return obj;
}

void ServicesResponse::fromJson(const QJsonObject& json) {
    base.fromJson(json);
    services.clear();

    QJsonObject servicesObj = json["services"].toObject();
    for (auto it = servicesObj.begin(); it != servicesObj.end(); ++it) {
        Service service;
        service.fromJson(it.value().toObject());
        services[it.key()] = service;
    }
}

} // namespace Hydrui::API
