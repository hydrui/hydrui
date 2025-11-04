#include "add_file_response.h"
#include <QBuffer>
#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QTest>

class TestAddFileResponse : public QObject {
    Q_OBJECT

  private slots:
    void testDecodeCbor();
    void testRoundTripCbor();
    void testDecodeJson();
    void testRoundTripJson();
};

void TestAddFileResponse::testDecodeCbor() {
    QString hexString = "a366737461747573026468617368784039646638346133636666366638613366376439313263383564366439393366"
                        "353530383561346532393936356239663666326138373333366439373262643739646e6f7465786166696c65207265"
                        "636f676e697365643a20496d706f7274656420617420323032352d31302d31302031383a30303a30302c2077686963"
                        "68207761732031382064617973203120686f75722061676f206265666f7265207468697320636865636b2e";

    QByteArray cborData = QByteArray::fromHex(hexString.toLatin1());

    QBuffer buffer(&cborData);
    buffer.open(QIODevice::ReadOnly);

    QCborStreamReader reader(&buffer);
    Hydrui::API::AddFileResponse response;
    QCOMPARE(response.readFromCbor(reader).error(), true);

    // Verify the decoded values
    QCOMPARE(response.status, 2);
    QCOMPARE(response.hash, QString("9df84a3cff6f8a3f7d912c85d6d993f55085a4e29965b9f6f2a87336d972bd79"));
    QCOMPARE(
        response.note,
        QString("file recognised: Imported at 2025-10-10 18:00:00, which was 18 days 1 hour ago before this check."));
    QVERIFY(!response.traceback.has_value());
}

void TestAddFileResponse::testRoundTripCbor() {
    // Create an AddFileResponse object with known values
    Hydrui::API::AddFileResponse expected;
    expected.base.version = 81;
    expected.base.hydrusVersion = 641;
    expected.status = 2;
    expected.hash = "9df84a3cff6f8a3f7d912c85d6d993f55085a4e29965b9f6f2a87336d972bd79";
    expected.note = "file recognised: Imported at 2025-10-10 18:00:00, which was 18 days 1 hour ago before this check.";

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

    Hydrui::API::AddFileResponse response;
    QCOMPARE(response.readFromCbor(reader).has_value(), true);

    // Verify all fields match
    QCOMPARE(response.base.version, expected.base.version);
    QCOMPARE(response.base.hydrusVersion, expected.base.hydrusVersion);
    QCOMPARE(response.status, expected.status);
    QCOMPARE(response.hash, expected.hash);
    QCOMPARE(response.note, expected.note);
    QCOMPARE(response.traceback.has_value(), expected.traceback.has_value());
}

void TestAddFileResponse::testDecodeJson() {
    QJsonObject json;
    json["version"] = 81;
    json["hydrus_version"] = 641;
    json["status"] = 2;
    json["hash"] = "9df84a3cff6f8a3f7d912c85d6d993f55085a4e29965b9f6f2a87336d972bd79";
    json["note"] = "file recognised: Imported at 2025-10-10 18:00:00, which was 18 days 1 hour ago before this check.";

    Hydrui::API::AddFileResponse response;
    response.fromJson(json);

    // Verify the decoded values
    QCOMPARE(response.base.version, 81);
    QCOMPARE(response.base.hydrusVersion, 641);
    QCOMPARE(response.status, 2);
    QCOMPARE(response.hash, QString("9df84a3cff6f8a3f7d912c85d6d993f55085a4e29965b9f6f2a87336d972bd79"));
    QCOMPARE(
        response.note,
        QString("file recognised: Imported at 2025-10-10 18:00:00, which was 18 days 1 hour ago before this check."));
    QVERIFY(!response.traceback.has_value());
}

void TestAddFileResponse::testRoundTripJson() {
    // Create an AddFileResponse object with known values
    Hydrui::API::AddFileResponse originalResponse;
    originalResponse.base.version = 81;
    originalResponse.base.hydrusVersion = 641;
    originalResponse.status = 2;
    originalResponse.hash = "9df84a3cff6f8a3f7d912c85d6d993f55085a4e29965b9f6f2a87336d972bd79";
    originalResponse.note =
        "file recognised: Imported at 2025-10-10 18:00:00, which was 18 days 1 hour ago before this check.";

    // Encode to JSON
    QJsonObject json = originalResponse.toJson();

    // Decode from JSON
    Hydrui::API::AddFileResponse decodedResponse;
    decodedResponse.fromJson(json);

    // Verify all fields match
    QCOMPARE(decodedResponse.base.version, originalResponse.base.version);
    QCOMPARE(decodedResponse.base.hydrusVersion, originalResponse.base.hydrusVersion);
    QCOMPARE(decodedResponse.status, originalResponse.status);
    QCOMPARE(decodedResponse.hash, originalResponse.hash);
    QCOMPARE(decodedResponse.note, originalResponse.note);
    QCOMPARE(decodedResponse.traceback.has_value(), originalResponse.traceback.has_value());
}

QTEST_MAIN(TestAddFileResponse)
#include "add_file_response_test.moc"
