#pragma once

#include "api_response.h"
#include "file_metadata.h"
#include "interfaces.h"
#include "services_response.h"
#include <QVector>
#include <optional>

namespace Hydrui::API {

struct FileMetadataResponse : public IRequestResponseBody {
    ApiResponse base;
    std::optional<ServicesObject> services;
    QVector<FileMetadata> metadata;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
