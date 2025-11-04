#pragma once

#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QJsonArray>
#include <QJsonValue>
#include <QString>
#include <QVector>
#include <optional>

namespace Hydrui::API {

void cborReparseIfNeeded(QCborStreamReader& reader);
void cborNext(QCborStreamReader& reader, int maxRecursion = 10000);
QString readCompleteString(QCborStreamReader& reader);

void writeStringArray(QCborStreamWriter& writer, const QVector<QString>& array);
void readStringArray(QCborStreamReader& reader, QVector<QString>& array);

void writeIntArray(QCborStreamWriter& writer, const QVector<int>& array);
void readIntArray(QCborStreamReader& reader, QVector<int>& array);

QJsonArray stringListToJson(const QVector<QString>& vec);
QVector<QString> jsonToStringVector(const QJsonArray& arr);

QJsonArray intVectorToJson(const QVector<int>& vec);
QVector<int> jsonToIntVector(const QJsonArray& arr);

template<typename T> void writeOptional(QCborStreamWriter& writer, const std::optional<T>& opt) {
    if (opt.has_value()) {
        writer.append(opt.value());
    } else {
        writer.append(QCborSimpleType::Null);
    }
}

template<typename T> QJsonValue optionalToJson(const std::optional<T>& opt) {
    if (opt.has_value()) {
        if constexpr (std::is_same_v<T, QString>) {
            return QJsonValue(opt.value());
        } else if constexpr (std::is_same_v<T, bool>) {
            return QJsonValue(opt.value());
        } else if constexpr (std::is_integral_v<T>) {
            return QJsonValue(static_cast<qint64>(opt.value()));
        }
    }
    return QJsonValue();
}

template<typename T> void jsonToOptional(const QJsonValue& value, std::optional<T>& opt) {
    if (value.isNull() || value.isUndefined()) {
        opt = std::nullopt;
    } else {
        if constexpr (std::is_same_v<T, QString>) {
            opt = value.toString();
        } else if constexpr (std::is_same_v<T, bool>) {
            opt = value.toBool();
        } else if constexpr (std::is_integral_v<T>) {
            opt = static_cast<T>(value.toInteger());
        }
    }
}

} // namespace Hydrui::API
