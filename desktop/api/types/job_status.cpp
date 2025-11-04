#include "job_status.h"
#include "serialization.h"

namespace Hydrui::API {

void JobStatus::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("key");
    writer.append(key);
    writer.append("creation_time");
    writer.append(creationTime);
    if (hadError.has_value()) {
        writer.append("had_error");
        writer.append(*hadError);
    }
    if (isCancellable.has_value()) {
        writer.append("is_cancellable");
        writer.append(*isCancellable);
    }
    if (isCancelled.has_value()) {
        writer.append("is_cancelled");
        writer.append(*isCancelled);
    }
    if (isDone.has_value()) {
        writer.append("is_done");
        writer.append(*isDone);
    }
    if (isPausable.has_value()) {
        writer.append("is_pausable");
        writer.append(*isPausable);
    }
    if (isPaused.has_value()) {
        writer.append("is_paused");
        writer.append(*isPaused);
    }
    if (niceString.has_value()) {
        writer.append("nice_string");
        writer.append(*niceString);
    }
    writer.endMap();
}

void JobStatus::readFromCbor(QCborStreamReader& reader) {
    if (!reader.isMap()) {
        return;
    }
    reader.enterContainer();
    for (;;) {
        if (!reader.hasNext()) {
            reader.leaveContainer();
            return;
        }
        QString k = readCompleteString(reader);
        if (k == "key" && reader.isString()) {
            key = readCompleteString(reader);
        } else if (k == "creation_time" && reader.isInteger()) {
            creationTime = reader.toInteger();
        } else {
            reader.next();
        }
    }
}

QJsonObject JobStatus::toJson() const {
    QJsonObject obj;
    obj["key"] = key;
    obj["creation_time"] = creationTime;
    if (hadError.has_value())
        obj["had_error"] = *hadError;
    if (isCancellable.has_value())
        obj["is_cancellable"] = *isCancellable;
    if (isCancelled.has_value())
        obj["is_cancelled"] = *isCancelled;
    if (isDone.has_value())
        obj["is_done"] = *isDone;
    if (isPausable.has_value())
        obj["is_pausable"] = *isPausable;
    if (isPaused.has_value())
        obj["is_paused"] = *isPaused;
    if (niceString.has_value())
        obj["nice_string"] = *niceString;
    if (attachedFilesMergable.has_value())
        obj["attached_files_mergable"] = *attachedFilesMergable;
    if (files.has_value())
        obj["files"] = files->toJson();
    return obj;
}

void JobStatus::fromJson(const QJsonObject& json) {
    key = json["key"].toString();
    creationTime = json["creation_time"].toInteger();
    if (json.contains("had_error"))
        hadError = json["had_error"].toBool();
    if (json.contains("is_cancellable"))
        isCancellable = json["is_cancellable"].toBool();
    if (json.contains("is_cancelled"))
        isCancelled = json["is_cancelled"].toBool();
    if (json.contains("is_done"))
        isDone = json["is_done"].toBool();
    if (json.contains("is_pausable"))
        isPausable = json["is_pausable"].toBool();
    if (json.contains("is_paused"))
        isPaused = json["is_paused"].toBool();
    if (json.contains("nice_string"))
        niceString = json["nice_string"].toString();
    if (json.contains("attached_files_mergable"))
        attachedFilesMergable = json["attached_files_mergable"].toBool();
    if (json.contains("files")) {
        JobFiles jobFiles;
        jobFiles.fromJson(json["files"].toObject());
        files = jobFiles;
    }
}

} // namespace Hydrui::API
