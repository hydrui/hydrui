#include "service.h"
#include <QBuffer>
#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QtTest/QtTest>

class TestService : public QObject {
    Q_OBJECT

  private slots:
    void testDecodeCbor();
    void testRoundTripCbor();
    void testDecodeJson();
    void testRoundTripJson();
};

void TestService::testDecodeCbor() {
    QString hexString = "a6646e616d656e6e756d6572696320726174696e676474797065066b747970655f707265747479781e6c6f63616c20"
                        "6e756d65726963616c20726174696e6720736572766963656a737461725f7368617065686661742073746172696d69"
                        "6e5f737461727300696d61785f737461727305";

    QByteArray cborData = QByteArray::fromHex(hexString.toLatin1());

    QBuffer buffer(&cborData);
    buffer.open(QIODevice::ReadOnly);

    QCborStreamReader reader(&buffer);
    Hydrui::API::Service service;
    service.readFromCbor(reader);

    // Verify the decoded values
    QCOMPARE(service.name, QString("numeric rating"));
    QCOMPARE(service.type, 6);
    QCOMPARE(service.typePretty, QString("local numerical rating service"));
    QVERIFY(service.starShape.has_value());
    QCOMPARE(*service.starShape, QString("fat star"));
    QVERIFY(service.minStars.has_value());
    QCOMPARE(*service.minStars, 0);
    QVERIFY(service.maxStars.has_value());
    QCOMPARE(*service.maxStars, 5);
    QVERIFY(!service.serviceKey.has_value());
}

void TestService::testRoundTripCbor() {
    // Create a Service object with known values
    Hydrui::API::Service originalService;
    originalService.name = "numeric rating";
    originalService.type = 6;
    originalService.typePretty = "local numerical rating service";
    originalService.starShape = "fat star";
    originalService.minStars = 0;
    originalService.maxStars = 5;

    // Encode to CBOR
    QByteArray cborData;
    QBuffer buffer(&cborData);
    buffer.open(QIODevice::WriteOnly);

    QCborStreamWriter writer(&buffer);
    originalService.writeToCbor(writer);
    buffer.close();

    // Decode from CBOR
    buffer.open(QIODevice::ReadOnly);
    QCborStreamReader reader(&buffer);

    Hydrui::API::Service service;
    service.readFromCbor(reader);

    // Verify all fields match
    QCOMPARE(service.name, originalService.name);
    QCOMPARE(service.type, originalService.type);
    QCOMPARE(service.typePretty, originalService.typePretty);

    QCOMPARE(service.starShape.has_value(), originalService.starShape.has_value());
    if (service.starShape.has_value() && originalService.starShape.has_value()) {
        QCOMPARE(*service.starShape, *originalService.starShape);
    }

    QCOMPARE(service.minStars.has_value(), originalService.minStars.has_value());
    if (service.minStars.has_value() && originalService.minStars.has_value()) {
        QCOMPARE(*service.minStars, *originalService.minStars);
    }

    QCOMPARE(service.maxStars.has_value(), originalService.maxStars.has_value());
    if (service.maxStars.has_value() && originalService.maxStars.has_value()) {
        QCOMPARE(*service.maxStars, *originalService.maxStars);
    }

    QCOMPARE(service.serviceKey.has_value(), originalService.serviceKey.has_value());
}

void TestService::testDecodeJson() {
    QJsonObject json;
    json["name"] = "numeric rating";
    json["type"] = 6;
    json["type_pretty"] = "local numerical rating service";
    json["star_shape"] = "fat star";
    json["min_stars"] = 0;
    json["max_stars"] = 5;

    Hydrui::API::Service service;
    service.fromJson(json);

    QCOMPARE(service.name, QString("numeric rating"));
    QCOMPARE(service.type, 6);
    QCOMPARE(service.typePretty, QString("local numerical rating service"));
    QVERIFY(service.starShape.has_value());
    QCOMPARE(*service.starShape, QString("fat star"));
    QVERIFY(service.minStars.has_value());
    QCOMPARE(*service.minStars, 0);
    QVERIFY(service.maxStars.has_value());
    QCOMPARE(*service.maxStars, 5);
    QVERIFY(!service.serviceKey.has_value());
}

void TestService::testRoundTripJson() {
    Hydrui::API::Service originalService;
    originalService.name = "numeric rating";
    originalService.type = 6;
    originalService.typePretty = "local numerical rating service";
    originalService.starShape = "fat star";
    originalService.minStars = 0;
    originalService.maxStars = 5;

    QJsonObject json = originalService.toJson();

    Hydrui::API::Service decodedService;
    decodedService.fromJson(json);

    QCOMPARE(decodedService.name, originalService.name);
    QCOMPARE(decodedService.type, originalService.type);
    QCOMPARE(decodedService.typePretty, originalService.typePretty);
    QCOMPARE(decodedService.starShape.has_value(), originalService.starShape.has_value());
    if (decodedService.starShape.has_value() && originalService.starShape.has_value()) {
        QCOMPARE(*decodedService.starShape, *originalService.starShape);
    }
    QCOMPARE(decodedService.minStars.has_value(), originalService.minStars.has_value());
    if (decodedService.minStars.has_value() && originalService.minStars.has_value()) {
        QCOMPARE(*decodedService.minStars, *originalService.minStars);
    }
    QCOMPARE(decodedService.maxStars.has_value(), originalService.maxStars.has_value());
    if (decodedService.maxStars.has_value() && originalService.maxStars.has_value()) {
        QCOMPARE(*decodedService.maxStars, *originalService.maxStars);
    }

    QCOMPARE(decodedService.serviceKey.has_value(), originalService.serviceKey.has_value());
}

QTEST_MAIN(TestService)
#include "service_test.moc"
