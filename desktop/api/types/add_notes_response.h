#pragma once

#include "interfaces.h"
#include <QMap>
#include <QString>

namespace Hydrui::API {

struct AddNotesResponse : public IRequestResponseBody {
    QMap<QString, QString> notes;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
