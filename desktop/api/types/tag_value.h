#pragma once

#include <QJsonObject>
#include <QString>

namespace Hydrui::API {

struct TagValue {
    QString value;
    int count = 0;

    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
