package wisp

import (
	"encoding/binary"
	"errors"
	"fmt"
)

// Packet Types
const (
	PacketTypeConnect  uint8 = 0x01
	PacketTypeData     uint8 = 0x02
	PacketTypeContinue uint8 = 0x03
	PacketTypeClose    uint8 = 0x04
)

// Stream Types
const (
	StreamTypeTCP uint8 = 0x01
	StreamTypeUDP uint8 = 0x02
)

// Close Reasons
const (
	CloseReasonUnknown             uint8 = 0x01
	CloseReasonVoluntary           uint8 = 0x02
	CloseReasonNetworkError        uint8 = 0x03
	CloseReasonInvalidInfo         uint8 = 0x41
	CloseReasonUnreachable         uint8 = 0x42
	CloseReasonTimeout             uint8 = 0x43
	CloseReasonRefused             uint8 = 0x44
	CloseReasonTCPDataTimeout      uint8 = 0x47
	CloseReasonBlocked             uint8 = 0x48
	CloseReasonThrottled           uint8 = 0x49
	CloseReasonClientUnexpectedErr uint8 = 0x81
)

// Packet represents a generic Wisp packet.
type Packet struct {
	Type     uint8
	StreamID uint32
	Payload  []byte
}

// ConnectPayload represents the payload for a CONNECT packet.
type ConnectPayload struct {
	StreamType uint8
	Port       uint16
	Hostname   string
}

// ContinuePayload represents the payload for a CONTINUE packet.
type ContinuePayload struct {
	BufferRemaining uint32
}

// ClosePayload represents the payload for a CLOSE packet.
type ClosePayload struct {
	Reason uint8
}

// SerializePacket serializes a Packet into a byte slice.
func SerializePacket(p Packet) []byte {
	// 1 byte Type + 4 bytes StreamID + Payload
	buf := make([]byte, 1+4+len(p.Payload))
	buf[0] = p.Type
	binary.LittleEndian.PutUint32(buf[1:5], p.StreamID)
	copy(buf[5:], p.Payload)
	return buf
}

// ParsePacket parses a byte slice into a Packet.
func ParsePacket(data []byte) (Packet, error) {
	if len(data) < 5 {
		return Packet{}, errors.New("packet too short")
	}
	p := Packet{
		Type:     data[0],
		StreamID: binary.LittleEndian.Uint32(data[1:5]),
		Payload:  data[5:],
	}
	return p, nil
}

// SerializeConnectPayload serializes a ConnectPayload.
func SerializeConnectPayload(p ConnectPayload) []byte {
	hostnameBytes := []byte(p.Hostname)
	// 1 byte StreamType + 2 bytes Port + Hostname
	buf := make([]byte, 1+2+len(hostnameBytes))
	buf[0] = p.StreamType
	binary.LittleEndian.PutUint16(buf[1:3], p.Port)
	copy(buf[3:], hostnameBytes)
	return buf
}

// ParseConnectPayload parses a ConnectPayload from a byte slice.
func ParseConnectPayload(data []byte) (ConnectPayload, error) {
	if len(data) < 3 {
		return ConnectPayload{}, errors.New("connect payload too short")
	}
	return ConnectPayload{
		StreamType: data[0],
		Port:       binary.LittleEndian.Uint16(data[1:3]),
		Hostname:   string(data[3:]),
	}, nil
}

// SerializeContinuePayload serializes a ContinuePayload.
func SerializeContinuePayload(p ContinuePayload) []byte {
	buf := make([]byte, 4)
	binary.LittleEndian.PutUint32(buf, p.BufferRemaining)
	return buf
}

// ParseContinuePayload parses a ContinuePayload from a byte slice.
func ParseContinuePayload(data []byte) (ContinuePayload, error) {
	if len(data) < 4 {
		return ContinuePayload{}, errors.New("continue payload too short")
	}
	return ContinuePayload{
		BufferRemaining: binary.LittleEndian.Uint32(data),
	}, nil
}

// SerializeClosePayload serializes a ClosePayload.
func SerializeClosePayload(p ClosePayload) []byte {
	return []byte{p.Reason}
}

// ParseClosePayload parses a ClosePayload from a byte slice.
func ParseClosePayload(data []byte) (ClosePayload, error) {
	if len(data) < 1 {
		return ClosePayload{}, errors.New("close payload too short")
	}
	return ClosePayload{
		Reason: data[0],
	}, nil
}

// Helper to construct a close packet
func NewClosePacket(streamID uint32, reason uint8) Packet {
	return Packet{
		Type:     PacketTypeClose,
		StreamID: streamID,
		Payload:  SerializeClosePayload(ClosePayload{Reason: reason}),
	}
}

// Helper to construct a continue packet
func NewContinuePacket(streamID uint32, bufferRemaining uint32) Packet {
	return Packet{
		Type:     PacketTypeContinue,
		StreamID: streamID,
		Payload:  SerializeContinuePayload(ContinuePayload{BufferRemaining: bufferRemaining}),
	}
}

// Helper to construct a data packet
func NewDataPacket(streamID uint32, data []byte) Packet {
	return Packet{
		Type:     PacketTypeData,
		StreamID: streamID,
		Payload:  data,
	}
}

func (p Packet) String() string {
	return fmt.Sprintf("Packet{Type: %d, StreamID: %d, PayloadLen: %d}", p.Type, p.StreamID, len(p.Payload))
}
