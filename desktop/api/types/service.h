#pragma once

#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QString>
#include <optional>

namespace Hydrui::API {

struct Service {
    QString name;
    int type = 0;
    QString typePretty;
    std::optional<QString> serviceKey;
    std::optional<QString> starShape;
    std::optional<int> minStars;
    std::optional<int> maxStars;

    void writeToCbor(QCborStreamWriter& writer) const;
    void readFromCbor(QCborStreamReader& reader);
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
