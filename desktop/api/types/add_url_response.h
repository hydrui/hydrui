#pragma once

#include "api_response.h"
#include "interfaces.h"
#include <QString>

namespace Hydrui::API {

struct AddUrlResponse : public IRequestResponseBody {
    ApiResponse base;
    QString humanResultText;
    QString normalisedUrl;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
