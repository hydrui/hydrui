#include "page.h"
#include "serialization.h"
#include <QJsonArray>
#include <QJsonObject>

namespace Hydrui::API {

void Page::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("name");
    writer.append(name);
    writer.append("page_key");
    writer.append(pageKey);
    if (pageState.has_value()) {
        writer.append("page_state");
        writer.append(*pageState);
    }
    if (pageType.has_value()) {
        writer.append("page_type");
        writer.append(*pageType);
    }
    if (isMediaPage.has_value()) {
        writer.append("is_media_page");
        writer.append(*isMediaPage);
    }
    if (selected.has_value()) {
        writer.append("selected");
        writer.append(*selected);
    }
    if (pages.has_value()) {
        writer.append("pages");
        writer.startArray(pages->size());
        for (const auto& page : *pages) {
            page.writeToCbor(writer);
        }
        writer.endArray();
    }
    writer.endMap();
}

void Page::readFromCbor(QCborStreamReader& reader) {
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
        } else if (key == "page_key" && reader.isString()) {
            pageKey = readCompleteString(reader);
        } else {
            reader.next();
        }
    }
}

QJsonObject Page::toJson() const {
    QJsonObject obj;
    obj["name"] = name;
    obj["page_key"] = pageKey;
    if (pageState.has_value())
        obj["page_state"] = *pageState;
    if (pageType.has_value())
        obj["page_type"] = *pageType;
    if (isMediaPage.has_value())
        obj["is_media_page"] = *isMediaPage;
    if (selected.has_value())
        obj["selected"] = *selected;
    if (pages.has_value()) {
        QJsonArray pagesArray;
        for (const auto& page : *pages) {
            pagesArray.append(page.toJson());
        }
        obj["pages"] = pagesArray;
    }
    return obj;
}

void Page::fromJson(const QJsonObject& json) {
    name = json["name"].toString();
    pageKey = json["page_key"].toString();
    if (json.contains("page_state"))
        pageState = json["page_state"].toInt();
    if (json.contains("page_type"))
        pageType = json["page_type"].toInt();
    if (json.contains("is_media_page"))
        isMediaPage = json["is_media_page"].toBool();
    if (json.contains("selected"))
        selected = json["selected"].toBool();
    if (json.contains("pages")) {
        QVector<Page> pagesVec;
        QJsonArray pagesArray = json["pages"].toArray();
        for (const auto& val : pagesArray) {
            Page page;
            page.fromJson(val.toObject());
            pagesVec.append(page);
        }
        pages = pagesVec;
    }
}

} // namespace Hydrui::API
