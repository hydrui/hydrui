#pragma once

#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QString>

namespace Hydrui::API {

struct FileIdentifier {
    int fileId = 0;
    QString hash;

    void writeToCbor(QCborStreamWriter& writer) const;
    void readFromCbor(QCborStreamReader& reader);
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
