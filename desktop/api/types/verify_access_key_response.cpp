#include "verify_access_key_response.h"
#include "serialization.h"
#include <QIODevice>

namespace Hydrui::API {

void VerifyAccessKeyResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("name");
    writer.append(name);
    writer.append("permits_everything");
    writer.append(permitsEverything);
    writer.append("basic_permissions");
    writeIntArray(writer, basicPermissions);
    writer.append("human_description");
    writer.append(humanDescription);
    writer.append("version");
    writer.append(base.version);
    writer.append("hydrus_version");
    writer.append(base.hydrusVersion);
    writer.endMap();
}

std::expected<void, QCborError> VerifyAccessKeyResponse::readFromCbor(QCborStreamReader& reader) {
    try {
        fprintf(stderr, "1[%lld]", reader.device()->pos());
        if (!reader.isMap()) {
            fprintf(stderr, "x");
            return {};
        }
        fprintf(stderr, "2[%lld]", reader.device()->pos());
        reader.enterContainer();
        for (;;) {
            fprintf(stderr, "3[%lld]", reader.device()->pos());
            if (!reader.hasNext()) {
                fprintf(stderr, "y");
                reader.leaveContainer();
                return {};
            }
            fprintf(stderr, "4[%lld]", reader.device()->pos());
            QString key = readCompleteString(reader);

            if (key == "name" && reader.isString()) {
                fprintf(stderr, "5[%lld]", reader.device()->pos());
                name = readCompleteString(reader);
            } else if (key == "permits_everything" && reader.isBool()) {
                fprintf(stderr, "6");
                permitsEverything = reader.toBool();
            } else if (key == "basic_permissions" && reader.isArray()) {
                fprintf(stderr, "7");
                readIntArray(reader, basicPermissions);
            } else if (key == "human_description" && reader.isString()) {
                fprintf(stderr, "8");
                humanDescription = readCompleteString(reader);
            } else if (key == "version" && reader.isInteger()) {
                fprintf(stderr, "9");
                base.version = reader.toInteger();
            } else if (key == "hydrus_version" && reader.isInteger()) {
                fprintf(stderr, "10");
                base.hydrusVersion = reader.toInteger();
            } else {
                fprintf(stderr, "11");
                reader.next();
            }
        }
    } catch (QCborError error) {
        fprintf(stderr, "z");
        return std::unexpected(error);
    }
}

QJsonObject VerifyAccessKeyResponse::toJson() const {
    QJsonObject obj = base.toJson();
    obj["name"] = name;
    obj["permits_everything"] = permitsEverything;
    obj["basic_permissions"] = intVectorToJson(basicPermissions);
    obj["human_description"] = humanDescription;
    return obj;
}

void VerifyAccessKeyResponse::fromJson(const QJsonObject& json) {
    base.fromJson(json);
    name = json["name"].toString();
    permitsEverything = json["permits_everything"].toBool();
    basicPermissions = jsonToIntVector(json["basic_permissions"].toArray());
    humanDescription = json["human_description"].toString();
}

} // namespace Hydrui::API
