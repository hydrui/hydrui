#include "add_tags_request.h"
#include "serialization.h"
#include <QJsonArray>

namespace Hydrui::API {

void AddTagsRequest::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    files.writeToCbor(writer);

    writer.append("service_keys_to_actions_to_tags");
    writer.startMap();
    for (auto it = serviceKeysToActionsToTags.begin(); it != serviceKeysToActionsToTags.end(); ++it) {
        writer.append(it.key());
        writer.startMap();
        for (auto actionIt = it.value().begin(); actionIt != it.value().end(); ++actionIt) {
            writer.append(actionIt.key());
            writeStringArray(writer, actionIt.value());
        }
        writer.endMap();
    }
    writer.endMap();

    if (serviceKeysToTags.has_value()) {
        writer.append("service_keys_to_tags");
        writer.startMap();
        for (auto it = serviceKeysToTags->begin(); it != serviceKeysToTags->end(); ++it) {
            writer.append(it.key());
            writeStringArray(writer, it.value());
        }
        writer.endMap();
    }

    writer.endMap();
}

std::expected<void, QCborError> AddTagsRequest::readFromCbor(QCborStreamReader& reader) {
    try {
        if (!reader.isMap()) {
            return {};
        }
        reader.enterContainer();
        for (;;) {
            if (!reader.hasNext()) {
                reader.leaveContainer();
                return {};
            }
            QString key = readCompleteString(reader);

            if (key == "service_keys_to_actions_to_tags" && reader.isMap()) {
                serviceKeysToActionsToTags.clear();
                reader.enterContainer();
                for (;;) {
                    if (!reader.hasNext()) {
                        reader.leaveContainer();
                        break;
                    }
                    QString serviceKey = readCompleteString(reader);

                    TagUpdate tagUpdate;
                    if (reader.isMap()) {
                        reader.enterContainer();
                        for (;;) {
                            if (!reader.hasNext()) {
                                reader.leaveContainer();
                                break;
                            }
                            int action = 0;
                            if (reader.isInteger()) {
                                action = reader.toInteger();
                            }

                            QVector<QString> tags;
                            if (reader.isArray()) {
                                readStringArray(reader, tags);
                            }
                            tagUpdate[action] = tags;
                        }
                    }
                    serviceKeysToActionsToTags[serviceKey] = tagUpdate;
                }
            } else if (key == "service_keys_to_tags" && reader.isMap()) {
                QMap<QString, QVector<QString>> tagsMap;
                reader.enterContainer();
                for (;;) {
                    if (!reader.hasNext()) {
                        reader.leaveContainer();
                        break;
                    }
                    QString serviceKey = readCompleteString(reader);

                    QVector<QString> tags;
                    if (reader.isArray()) {
                        readStringArray(reader, tags);
                    }
                    tagsMap[serviceKey] = tags;
                }
                serviceKeysToTags = tagsMap;
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject AddTagsRequest::toJson() const {
    QJsonObject obj = files.toJson();

    QJsonObject actionsObj;
    for (auto it = serviceKeysToActionsToTags.begin(); it != serviceKeysToActionsToTags.end(); ++it) {
        QJsonObject tagActionsObj;
        for (auto actionIt = it.value().begin(); actionIt != it.value().end(); ++actionIt) {
            tagActionsObj[QString::number(actionIt.key())] = stringListToJson(actionIt.value());
        }
        actionsObj[it.key()] = tagActionsObj;
    }
    obj["service_keys_to_actions_to_tags"] = actionsObj;

    if (serviceKeysToTags.has_value()) {
        QJsonObject tagsObj;
        for (auto it = serviceKeysToTags->begin(); it != serviceKeysToTags->end(); ++it) {
            tagsObj[it.key()] = stringListToJson(it.value());
        }
        obj["service_keys_to_tags"] = tagsObj;
    }

    return obj;
}

void AddTagsRequest::fromJson(const QJsonObject& json) {
    files.fromJson(json);

    serviceKeysToActionsToTags.clear();
    QJsonObject actionsObj = json["service_keys_to_actions_to_tags"].toObject();
    for (auto serviceIt = actionsObj.begin(); serviceIt != actionsObj.end(); ++serviceIt) {
        TagUpdate tagUpdate;
        QJsonObject tagActionsObj = serviceIt.value().toObject();
        for (auto actionIt = tagActionsObj.begin(); actionIt != tagActionsObj.end(); ++actionIt) {
            int action = actionIt.key().toInt();
            tagUpdate[action] = jsonToStringVector(actionIt.value().toArray());
        }
        serviceKeysToActionsToTags[serviceIt.key()] = tagUpdate;
    }

    if (json.contains("service_keys_to_tags")) {
        QMap<QString, QVector<QString>> tagsMap;
        QJsonObject tagsObj = json["service_keys_to_tags"].toObject();
        for (auto it = tagsObj.begin(); it != tagsObj.end(); ++it) {
            tagsMap[it.key()] = jsonToStringVector(it.value().toArray());
        }
        serviceKeysToTags = tagsMap;
    }
}

} // namespace Hydrui::API
