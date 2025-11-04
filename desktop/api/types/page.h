#pragma once

#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QString>
#include <QVector>
#include <optional>

namespace Hydrui::API {

struct Page {
    QString name;
    QString pageKey;
    std::optional<int> pageState;
    std::optional<int> pageType;
    std::optional<bool> isMediaPage;
    std::optional<bool> selected;
    std::optional<QVector<Page>> pages;

    void writeToCbor(QCborStreamWriter& writer) const;
    void readFromCbor(QCborStreamReader& reader);
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
