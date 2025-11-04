#include "service.h"
#include "serialization.h"
#include <QJsonObject>

namespace Hydrui::API {

void Service::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("name");
    writer.append(name);
    writer.append("type");
    writer.append(type);
    writer.append("type_pretty");
    writer.append(typePretty);

    if (serviceKey.has_value()) {
        writer.append("service_key");
        writer.append(*serviceKey);
    }
    if (starShape.has_value()) {
        writer.append("star_shape");
        writer.append(*starShape);
    }
    if (minStars.has_value()) {
        writer.append("min_stars");
        writer.append(*minStars);
    }
    if (maxStars.has_value()) {
        writer.append("max_stars");
        writer.append(*maxStars);
    }

    writer.endMap();
}

void Service::readFromCbor(QCborStreamReader& reader) {
    if (!reader.isMap()) {
        return;
    }
    reader.enterContainer();
    for (;;) {
        if (!reader.hasNext()) {
            reader.leaveContainer();
            return;
        }
        QString key = readCompleteString(reader);
        if (key == "name" && reader.isString()) {
            name = readCompleteString(reader);
        } else if (key == "type" && reader.isInteger()) {
            type = reader.toInteger();
        } else if (key == "type_pretty" && reader.isString()) {
            typePretty = readCompleteString(reader);
        } else if (key == "service_key" && reader.isString()) {
            serviceKey = readCompleteString(reader);
        } else if (key == "star_shape" && reader.isString()) {
            starShape = readCompleteString(reader);
        } else if (key == "min_stars" && reader.isInteger()) {
            minStars = reader.toInteger();
        } else if (key == "max_stars" && reader.isInteger()) {
            maxStars = reader.toInteger();
        } else {
            reader.next();
        }
    }
}

QJsonObject Service::toJson() const {
    QJsonObject obj;
    obj["name"] = name;
    obj["type"] = type;
    obj["type_pretty"] = typePretty;

    if (serviceKey.has_value()) {
        obj["service_key"] = *serviceKey;
    }
    if (starShape.has_value()) {
        obj["star_shape"] = *starShape;
    }
    if (minStars.has_value()) {
        obj["min_stars"] = *minStars;
    }
    if (maxStars.has_value()) {
        obj["max_stars"] = *maxStars;
    }

    return obj;
}

void Service::fromJson(const QJsonObject& json) {
    name = json["name"].toString();
    type = json["type"].toInt();
    typePretty = json["type_pretty"].toString();

    if (json.contains("service_key")) {
        serviceKey = json["service_key"].toString();
    }
    if (json.contains("star_shape")) {
        starShape = json["star_shape"].toString();
    }
    if (json.contains("min_stars")) {
        minStars = json["min_stars"].toInt();
    }
    if (json.contains("max_stars")) {
        maxStars = json["max_stars"].toInt();
    }
}

} // namespace Hydrui::API
