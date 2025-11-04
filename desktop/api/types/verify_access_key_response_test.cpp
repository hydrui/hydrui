#include "verify_access_key_response.h"
#include <QBuffer>
#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QJsonArray>
#include <QTest>
#include <QTimer>

class TestVerifyAccessKeyResponse : public QObject {
    Q_OBJECT

  private slots:
    void testDecodeCbor();
    void testRoundTripCbor();
    void testDecodeJson();
    void testRoundTripJson();
};

void TestVerifyAccessKeyResponse::testDecodeCbor() {
    QString hexString =
        "a4646e616d65736e657720617069207065726d697373696f6e73727065726d6974735f65766572797468696e67f57162617369635f7065"
        "726d697373696f6e738e000102030405060708090a0b0c0d7168756d616e5f6465736372697074696f6e7836415049205065726d697373"
        "696f6e7320286e657720617069207065726d697373696f6e73293a2063616e20646f20616e797468696e67";

    QByteArray cborData = QByteArray::fromHex(hexString.toLatin1());

    QBuffer buffer(&cborData);
    buffer.open(QIODevice::ReadOnly);

    QCborStreamReader reader(&buffer);
    Hydrui::API::VerifyAccessKeyResponse response;
    QCOMPARE(response.readFromCbor(reader).has_value(), true);

    QCOMPARE(response.name, QString("new api permissions"));
    QCOMPARE(response.permitsEverything, true);
    QCOMPARE(response.basicPermissions.size(), 14);
    for (int i = 0; i < 14; i++) {
        QCOMPARE(response.basicPermissions[i], i);
    }
    QCOMPARE(response.humanDescription, QString("API Permissions (new api permissions): can do anything"));
}

void TestVerifyAccessKeyResponse::testRoundTripCbor() {
    Hydrui::API::VerifyAccessKeyResponse expected;
    expected.base.version = 81;
    expected.base.hydrusVersion = 643;
    expected.name = "new api permissions";
    expected.permitsEverything = true;
    expected.basicPermissions = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13};
    expected.humanDescription = "API Permissions (new api permissions): can do anything";

    // Encode to CBOR
    QByteArray cborData;
    QBuffer buffer(&cborData);
    buffer.open(QIODevice::WriteOnly);
    QCborStreamWriter writer(&buffer);
    expected.writeToCbor(writer);
    buffer.close();

    // Decode from CBOR
    buffer.open(QIODevice::ReadOnly);
    QCborStreamReader reader(&buffer);
    Hydrui::API::VerifyAccessKeyResponse response;
    QCOMPARE(response.readFromCbor(reader).has_value(), true);

    QCOMPARE(response.base.version, expected.base.version);
    QCOMPARE(response.base.hydrusVersion, expected.base.hydrusVersion);
    QCOMPARE(response.name, expected.name);
    QCOMPARE(response.permitsEverything, expected.permitsEverything);
    QCOMPARE(response.basicPermissions.size(), expected.basicPermissions.size());
    for (int i = 0; i < expected.basicPermissions.size(); i++) {
        QCOMPARE(response.basicPermissions[i], expected.basicPermissions[i]);
    }
    QCOMPARE(response.humanDescription, expected.humanDescription);
}

void TestVerifyAccessKeyResponse::testDecodeJson() {
    QJsonObject json;
    json["name"] = "new api permissions";
    json["permits_everything"] = true;
    QJsonArray permissions;
    for (int i = 0; i < 14; i++) {
        permissions.append(i);
    }
    json["basic_permissions"] = permissions;
    json["human_description"] = "API Permissions (new api permissions): can do anything";
    json["version"] = 81;
    json["hydrus_version"] = 643;

    Hydrui::API::VerifyAccessKeyResponse response;
    response.fromJson(json);

    QCOMPARE(response.base.version, 81);
    QCOMPARE(response.base.hydrusVersion, 643);
    QCOMPARE(response.name, QString("new api permissions"));
    QCOMPARE(response.permitsEverything, true);
    QCOMPARE(response.basicPermissions.size(), 14);
    for (int i = 0; i < 14; i++) {
        QCOMPARE(response.basicPermissions[i], i);
    }
    QCOMPARE(response.humanDescription, QString("API Permissions (new api permissions): can do anything"));
}

void TestVerifyAccessKeyResponse::testRoundTripJson() {
    Hydrui::API::VerifyAccessKeyResponse originalResponse;
    originalResponse.base.version = 81;
    originalResponse.base.hydrusVersion = 643;
    originalResponse.name = "new api permissions";
    originalResponse.permitsEverything = true;
    originalResponse.basicPermissions = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13};
    originalResponse.humanDescription = "API Permissions (new api permissions): can do anything";
    QJsonObject json = originalResponse.toJson();

    Hydrui::API::VerifyAccessKeyResponse decodedResponse;
    decodedResponse.fromJson(json);

    QCOMPARE(decodedResponse.base.version, originalResponse.base.version);
    QCOMPARE(decodedResponse.base.hydrusVersion, originalResponse.base.hydrusVersion);
    QCOMPARE(decodedResponse.name, originalResponse.name);
    QCOMPARE(decodedResponse.permitsEverything, originalResponse.permitsEverything);
    QCOMPARE(decodedResponse.basicPermissions.size(), originalResponse.basicPermissions.size());
    for (int i = 0; i < originalResponse.basicPermissions.size(); i++) {
        QCOMPARE(decodedResponse.basicPermissions[i], originalResponse.basicPermissions[i]);
    }
    QCOMPARE(decodedResponse.humanDescription, originalResponse.humanDescription);
}

QTEST_MAIN(TestVerifyAccessKeyResponse)
#include "verify_access_key_response_test.moc"
