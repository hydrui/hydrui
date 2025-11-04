#include "add_file_response.h"
#include "serialization.h"

namespace Hydrui::API {

void AddFileResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("version");
    writer.append(base.version);
    writer.append("hydrus_version");
    writer.append(base.hydrusVersion);
    writer.append("status");
    writer.append(status);
    writer.append("hash");
    writer.append(hash);
    writer.append("note");
    writer.append(note);
    if (traceback.has_value()) {
        writer.append("traceback");
        writer.append(*traceback);
    }
    writer.endMap();
}

std::expected<void, QCborError> AddFileResponse::readFromCbor(QCborStreamReader& reader) {
    try {
        if (!reader.isMap()) {
            return {};
        }
        reader.enterContainer();
        for (;;) {
            if (auto error = reader.lastError()) {
                throw reader.lastError();
            }
            if (!reader.hasNext()) {
                reader.leaveContainer();
                return {};
            }
            QString key = reader.readAllString();
            if (key == "version" && reader.isInteger()) {
                base.version = reader.toInteger();
            } else if (key == "hydrus_version" && reader.isInteger()) {
                base.hydrusVersion = reader.toInteger();
            } else if (key == "status" && reader.isInteger()) {
                status = reader.toInteger();
            } else if (key == "hash" && reader.isString()) {
                hash = reader.readAllString();
            } else if (key == "note" && reader.isString()) {
                note = reader.readAllString();
            } else if (key == "traceback" && reader.isString()) {
                traceback = reader.readAllString();
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject AddFileResponse::toJson() const {
    QJsonObject obj = base.toJson();
    obj["status"] = status;
    obj["hash"] = hash;
    obj["note"] = note;
    if (traceback.has_value()) {
        obj["traceback"] = *traceback;
    }
    return obj;
}

void AddFileResponse::fromJson(const QJsonObject& json) {
    base.fromJson(json);
    status = json["status"].toInt();
    hash = json["hash"].toString();
    note = json["note"].toString();
    if (json.contains("traceback")) {
        traceback = json["traceback"].toString();
    }
}

} // namespace Hydrui::API
