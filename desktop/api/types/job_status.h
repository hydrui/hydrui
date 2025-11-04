#pragma once

#include "job_files.h"
#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QString>
#include <optional>

namespace Hydrui::API {

struct JobStatus {
    QString key;
    qint64 creationTime = 0;
    std::optional<bool> hadError;
    std::optional<bool> isCancellable;
    std::optional<bool> isCancelled;
    std::optional<bool> isDone;
    std::optional<bool> isPausable;
    std::optional<bool> isPaused;
    std::optional<QString> niceString;
    std::optional<bool> attachedFilesMergable;
    std::optional<JobFiles> files;

    void writeToCbor(QCborStreamWriter& writer) const;
    void readFromCbor(QCborStreamReader& reader);
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
