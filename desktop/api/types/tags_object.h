#pragma once

#include <QJsonObject>
#include <QMap>
#include <QString>
#include <QVector>

namespace Hydrui::API {

struct TagsObject {
    QMap<QString, QVector<QString>> storageTags;
    QMap<QString, QVector<QString>> displayTags;

    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
