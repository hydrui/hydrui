#pragma once

#include "interfaces.h"
#include <QString>

namespace Hydrui::API {

struct RefreshPageRequest : public IRequestResponseBody {
    QString pageKey;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
