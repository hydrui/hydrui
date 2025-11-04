#include "set_rating_request.h"
#include "serialization.h"
#include <QMetaType>

namespace Hydrui::API {

void SetRatingRequest::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    files.writeToCbor(writer);
    writer.append("rating_service_key");
    writer.append(ratingServiceKey);
    writer.append("rating");
    // Handle QVariant rating (can be bool, number, or null)
    if (rating.isNull()) {
        writer.append(nullptr);
    } else if (rating.userType() == QMetaType::Bool) {
        writer.append(rating.toBool());
    } else if (rating.canConvert<double>()) {
        writer.append(rating.toDouble());
    }
    writer.endMap();
}

std::expected<void, QCborError> SetRatingRequest::readFromCbor(QCborStreamReader& reader) {
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

            if (key == "rating_service_key" && reader.isString()) {
                ratingServiceKey = readCompleteString(reader);
            } else if (key == "rating") {
                if (reader.isNull()) {
                    rating = QVariant();
                    reader.next();
                } else if (reader.isBool()) {
                    rating = reader.toBool();
                } else if (reader.isDouble()) {
                    rating = reader.toDouble();
                    reader.next();
                } else if (reader.isInteger()) {
                    rating = reader.toInteger();
                } else {
                    reader.next();
                }
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject SetRatingRequest::toJson() const {
    QJsonObject obj = files.toJson();
    obj["rating_service_key"] = ratingServiceKey;
    obj["rating"] = QJsonValue::fromVariant(rating);
    return obj;
}

void SetRatingRequest::fromJson(const QJsonObject& json) {
    files.fromJson(json);
    ratingServiceKey = json["rating_service_key"].toString();
    rating = json["rating"].toVariant();
}

} // namespace Hydrui::API
