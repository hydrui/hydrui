#pragma once

#include "interfaces.h"
#include <QMap>
#include <QString>
#include <QVector>
#include <optional>

namespace Hydrui::API {

struct AddUrlRequest : public IRequestResponseBody {
    QString url;
    std::optional<QString> destinationPageKey;
    std::optional<QString> destinationPageName;
    std::optional<bool> showDestinationPage;
    std::optional<QMap<QString, QVector<QString>>> serviceKeysToAdditionalTags;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
