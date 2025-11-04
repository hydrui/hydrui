#pragma once

#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QCoroTask>
#include <QJsonObject>
#include <QString>
#include <optional>

namespace Hydrui::API {

struct FileRelationshipPair {
    QString hashA;
    QString hashB;
    int relationship = 0;
    bool doDefaultContentMerge = false;
    std::optional<bool> deleteA;
    std::optional<bool> deleteB;

    void writeToCbor(QCborStreamWriter& writer) const;
    void readFromCbor(QCborStreamReader& reader);
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
