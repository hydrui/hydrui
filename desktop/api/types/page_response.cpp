#include "page_response.h"
#include "serialization.h"

namespace Hydrui::API {

void PageResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("version");
    writer.append(base.version);
    writer.append("hydrus_version");
    writer.append(base.hydrusVersion);
    writer.append("pages");
    pages.writeToCbor(writer);
    writer.endMap();
}

std::expected<void, QCborError> PageResponse::readFromCbor(QCborStreamReader& reader) {
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
            } else if (key == "pages") {
                pages.readFromCbor(reader);
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject PageResponse::toJson() const {
    QJsonObject obj = base.toJson();
    obj["pages"] = pages.toJson();
    return obj;
}

void PageResponse::fromJson(const QJsonObject& json) {
    base.fromJson(json);
    pages.fromJson(json["pages"].toObject());
}

} // namespace Hydrui::API
