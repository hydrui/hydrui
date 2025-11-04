#include "add_url_request.h"
#include "serialization.h"

namespace Hydrui::API {

void AddUrlRequest::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("url");
    writer.append(url);
    if (destinationPageKey.has_value()) {
        writer.append("destination_page_key");
        writer.append(*destinationPageKey);
    }
    if (destinationPageName.has_value()) {
        writer.append("destination_page_name");
        writer.append(*destinationPageName);
    }
    if (showDestinationPage.has_value()) {
        writer.append("show_destination_page");
        writer.append(*showDestinationPage);
    }
    if (serviceKeysToAdditionalTags.has_value()) {
        writer.append("service_keys_to_additional_tags");
        writer.startMap();
        for (auto it = serviceKeysToAdditionalTags->begin(); it != serviceKeysToAdditionalTags->end(); ++it) {
            writer.append(it.key());
            writeStringArray(writer, it.value());
        }
        writer.endMap();
    }
    writer.endMap();
}

std::expected<void, QCborError> AddUrlRequest::readFromCbor(QCborStreamReader& reader) {
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

            if (key == "url" && reader.isString()) {
                url = readCompleteString(reader);
            } else if (key == "destination_page_key" && reader.isString()) {
                destinationPageKey = readCompleteString(reader);
            } else if (key == "destination_page_name" && reader.isString()) {
                destinationPageName = readCompleteString(reader);
            } else if (key == "show_destination_page" && reader.isBool()) {
                showDestinationPage = reader.toBool();
            } else if (key == "service_keys_to_additional_tags" && reader.isMap()) {
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
                serviceKeysToAdditionalTags = tagsMap;
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject AddUrlRequest::toJson() const {
    QJsonObject obj;
    obj["url"] = url;
    if (destinationPageKey.has_value()) {
        obj["destination_page_key"] = *destinationPageKey;
    }
    if (destinationPageName.has_value()) {
        obj["destination_page_name"] = *destinationPageName;
    }
    if (showDestinationPage.has_value()) {
        obj["show_destination_page"] = *showDestinationPage;
    }
    if (serviceKeysToAdditionalTags.has_value()) {
        QJsonObject tagsObj;
        for (auto it = serviceKeysToAdditionalTags->begin(); it != serviceKeysToAdditionalTags->end(); ++it) {
            tagsObj[it.key()] = stringListToJson(it.value());
        }
        obj["service_keys_to_additional_tags"] = tagsObj;
    }
    return obj;
}

void AddUrlRequest::fromJson(const QJsonObject& json) {
    url = json["url"].toString();
    if (json.contains("destination_page_key")) {
        destinationPageKey = json["destination_page_key"].toString();
    }
    if (json.contains("destination_page_name")) {
        destinationPageName = json["destination_page_name"].toString();
    }
    if (json.contains("show_destination_page")) {
        showDestinationPage = json["show_destination_page"].toBool();
    }
    if (json.contains("service_keys_to_additional_tags")) {
        QMap<QString, QVector<QString>> tagsMap;
        QJsonObject tagsObj = json["service_keys_to_additional_tags"].toObject();
        for (auto it = tagsObj.begin(); it != tagsObj.end(); ++it) {
            tagsMap[it.key()] = jsonToStringVector(it.value().toArray());
        }
        serviceKeysToAdditionalTags = tagsMap;
    }
}

} // namespace Hydrui::API
