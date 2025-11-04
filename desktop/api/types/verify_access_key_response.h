#pragma once

#include "api_response.h"
#include "interfaces.h"
#include <QString>
#include <QVector>

namespace Hydrui::API {

struct VerifyAccessKeyResponse : public IRequestResponseBody {
    ApiResponse base;
    QString name;
    bool permitsEverything;
    QVector<int> basicPermissions;
    QString humanDescription;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
