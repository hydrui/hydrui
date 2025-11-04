#pragma once

#include "tags_object.h"
#include <QMap>
#include <QString>
#include <QVariant>
#include <QVector>
#include <optional>

namespace Hydrui::API {

struct FileMetadata {
    int fileId{};
    QString hash;
    std::optional<qint64> size;
    std::optional<QString> mime;
    std::optional<int> filetypeEnum;
    std::optional<int> width;
    std::optional<int> height;
    std::optional<int> duration;
    std::optional<int> numFrames;
    std::optional<bool> hasAudio;
    std::optional<int> thumbnailWidth;
    std::optional<int> thumbnailHeight;
    std::optional<bool> isInbox;
    std::optional<bool> isLocal;
    std::optional<bool> isTrashed;
    std::optional<bool> isDeleted;
    std::optional<qint64> timeModified;
    std::optional<QVector<QString>> knownUrls;
    std::optional<QMap<QString, TagsObject>> tags;
    std::optional<QMap<QString, QVariant>> ratings; // Can be bool, number, or null
    std::optional<QMap<QString, QString>> notes;

    void writeToCbor(QCborStreamWriter& writer) const;
    void readFromCbor(QCborStreamReader& reader);
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
