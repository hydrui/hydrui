#include "serialization.h"
#include <QIODevice>

namespace Hydrui::API {

QString readCompleteString(QCborStreamReader& reader) {
    QString result;
    auto r = reader.readString();
    while (r.status == QCborStreamReader::Ok) {
        result += r.data;
        r = reader.readString();
    }
    if (r.status == QCborStreamReader::Error) {
        throw reader.lastError();
        result.clear();
    }
    return result;
}

void writeStringArray(QCborStreamWriter& writer, const QVector<QString>& array) {
    writer.startArray(array.size());
    for (const auto& str : array) {
        writer.append(str);
    }
    writer.endArray();
}

void readStringArray(QCborStreamReader& reader, QVector<QString>& array) {
    array.clear();
    if (!reader.isArray() || !reader.enterContainer()) {
        return;
    }
    for (;;) {
        if (!reader.hasNext()) {
            reader.leaveContainer();
            return;
        }
        if (!reader.isString()) {
            continue;
        }
        array.append(readCompleteString(reader));
    }
}

void writeIntArray(QCborStreamWriter& writer, const QVector<int>& array) {
    writer.startArray(array.size());
    for (int val : array) {
        writer.append(val);
    }
    writer.endArray();
}

void readIntArray(QCborStreamReader& reader, QVector<int>& array) {
    array.clear();
    if (!reader.isArray() || !reader.enterContainer()) {
        return;
    }
    for (;;) {
        if (!reader.hasNext()) {
            reader.leaveContainer();
            return;
        }
        if (reader.isInteger()) {
            array.append(reader.toInteger());
        }
    }
}

QJsonArray stringListToJson(const QVector<QString>& vec) {
    QJsonArray arr;
    for (const auto& str : vec) {
        arr.append(str);
    }
    return arr;
}

QVector<QString> jsonToStringVector(const QJsonArray& arr) {
    QVector<QString> vec;
    for (const auto& val : arr) {
        if (val.isString()) {
            vec.append(val.toString());
        }
    }
    return vec;
}

QJsonArray intVectorToJson(const QVector<int>& vec) {
    QJsonArray arr;
    for (int val : vec) {
        arr.append(val);
    }
    return arr;
}

QVector<int> jsonToIntVector(const QJsonArray& arr) {
    QVector<int> vec;
    for (const auto& val : arr) {
        if (val.isDouble()) {
            vec.append(val.toInt());
        }
    }
    return vec;
}

} // namespace Hydrui::API
