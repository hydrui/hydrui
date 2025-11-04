#pragma once

#include "api_response.h"
#include "interfaces.h"
#include "service.h"
#include <QMap>
#include <QString>

namespace Hydrui::API {

using ServicesObject = QMap<QString, Service>;

struct ServicesResponse : public IRequestResponseBody {
    ApiResponse base;
    ServicesObject services;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
