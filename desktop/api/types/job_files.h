#pragma once

#include <QJsonObject>
#include <QString>
#include <QVector>
#include <optional>

namespace Hydrui::API {

struct JobFiles {
    QVector<QString> hashes;
    std::optional<QString> label;

    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
