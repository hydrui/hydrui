package wisp

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPacketSerialization(t *testing.T) {
	t.Parallel()

	t.Run("Connect Packet", func(t *testing.T) {
		t.Parallel()

		payload := ConnectPayload{
			StreamType: StreamTypeTCP,
			Port:       8080,
			Hostname:   "example.com",
		}
		data := SerializeConnectPayload(payload)
		decoded, err := ParseConnectPayload(data)
		assert.NoError(t, err)
		assert.Equal(t, payload, decoded)

		packet := Packet{
			Type:     PacketTypeConnect,
			StreamID: 1,
			Payload:  data,
		}
		packetData := SerializePacket(packet)
		decodedPacket, err := ParsePacket(packetData)
		assert.NoError(t, err)
		assert.Equal(t, packet, decodedPacket)
	})

	t.Run("Data Packet", func(t *testing.T) {
		t.Parallel()

		packet := NewDataPacket(2, []byte("hello world"))
		data := SerializePacket(packet)
		decoded, err := ParsePacket(data)
		assert.NoError(t, err)
		assert.Equal(t, packet, decoded)
	})

	t.Run("Continue Packet", func(t *testing.T) {
		t.Parallel()

		payload := ContinuePayload{BufferRemaining: 100}
		packet := NewContinuePacket(3, 100)
		data := SerializePacket(packet)
		decodedPacket, err := ParsePacket(data)
		assert.NoError(t, err)
		assert.Equal(t, packet.Type, decodedPacket.Type)
		assert.Equal(t, packet.StreamID, decodedPacket.StreamID)

		decodedPayload, err := ParseContinuePayload(decodedPacket.Payload)
		assert.NoError(t, err)
		assert.Equal(t, payload, decodedPayload)
	})

	t.Run("Close Packet", func(t *testing.T) {
		t.Parallel()

		payload := ClosePayload{Reason: CloseReasonNetworkError}
		packet := NewClosePacket(4, CloseReasonNetworkError)
		data := SerializePacket(packet)
		decodedPacket, err := ParsePacket(data)
		assert.NoError(t, err)

		decodedPayload, err := ParseClosePayload(decodedPacket.Payload)
		assert.NoError(t, err)
		assert.Equal(t, payload, decodedPayload)
	})

	t.Run("Invalid Packets", func(t *testing.T) {
		t.Parallel()

		_, err := ParsePacket([]byte{1, 2, 3}) // Too short
		assert.Error(t, err)

		_, err = ParseConnectPayload([]byte{1}) // Too short
		assert.Error(t, err)
	})
}
