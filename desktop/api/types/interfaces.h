#pragma once

#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QCoroTask>
#include <QJsonObject>
#include <QUrlQuery>
#include <expected>

namespace Hydrui::API {

struct ICborSerializable {
    virtual ~ICborSerializable() = default;
    virtual void writeToCbor(QCborStreamWriter& writer) const = 0;
    virtual std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) = 0;
};

struct IJsonSerializable {
    virtual ~IJsonSerializable() = default;
    virtual QJsonObject toJson() const = 0;
    virtual void fromJson(const QJsonObject& json) = 0;
};

struct IUrlQuerySerializable {
    virtual ~IUrlQuerySerializable() = default;
    virtual QUrlQuery toUrlQuery() const = 0;
    virtual void fromUrlQuery(const QUrlQuery& query) = 0;
};

struct IRequestResponseBody : public ICborSerializable, public IJsonSerializable {
    virtual ~IRequestResponseBody() = default;
};

struct IUrlParams : public IUrlQuerySerializable {
    virtual ~IUrlParams() = default;
};

} // namespace Hydrui::API
