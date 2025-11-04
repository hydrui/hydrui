#include "set_kings_request.h"

namespace Hydrui::API {

void SetKingsRequest::writeToCbor(QCborStreamWriter& writer) const {
    files.writeToCbor(writer);
}

std::expected<void, QCborError> SetKingsRequest::readFromCbor(QCborStreamReader& reader) {
    try {
        files.readFromCbor(reader);
        return {};
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject SetKingsRequest::toJson() const {
    return files.toJson();
}

void SetKingsRequest::fromJson(const QJsonObject& json) {
    files.fromJson(json);
}

} // namespace Hydrui::API
