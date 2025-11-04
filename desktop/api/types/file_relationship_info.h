#pragma once

#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QCoroTask>
#include <QJsonObject>
#include <QString>

namespace Hydrui::API {

struct FileRelationshipInfo {
    bool isKing = false;
    QString king;
    bool kingIsOnFileDomain = true;
    bool kingIsLocal = true;

    void writeToCbor(QCborStreamWriter& writer) const;
    void readFromCbor(QCborStreamReader& reader);
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
