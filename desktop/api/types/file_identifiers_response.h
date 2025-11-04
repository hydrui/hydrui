#pragma once

#include "api_response.h"
#include "file_identifier.h"
#include "interfaces.h"
#include "services_response.h"
#include <QVector>

namespace Hydrui::API {

struct FileIdentifiersResponse : public IRequestResponseBody {
    ApiResponse base;
    ServicesObject services;
    QVector<FileIdentifier> metadata;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
