package wisp

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"runtime/pprof"
	"strconv"
	"sync"
	"sync/atomic"

	"github.com/gorilla/websocket"
)

const (
	DefaultWriteQueueLen = 64
	ReadBufferLen        = 32 * 1024
)

// Server handles Wisp WebSocket connections.
type Server struct {
	Dialer        Dialer
	WriteQueueLen uint32
	Upgrader      websocket.Upgrader
	Logger        *slog.Logger
}

type ServerOption func(*Server)

func WithWriteQueueLen(size uint32) ServerOption {
	return func(s *Server) {
		s.WriteQueueLen = size
	}
}

func WithUpgrader(upgrader websocket.Upgrader) ServerOption {
	return func(s *Server) {
		s.Upgrader = upgrader
	}
}

func WithLogger(logger *slog.Logger) ServerOption {
	return func(s *Server) {
		s.Logger = logger
	}
}

// NewServer creates a new Wisp server.
func NewServer(dialer Dialer, opts ...ServerOption) *Server {
	s := &Server{
		Dialer:        dialer,
		WriteQueueLen: DefaultWriteQueueLen,
		Upgrader:      websocket.Upgrader{},
		Logger:        slog.Default(),
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// ServeHTTP handles the WebSocket upgrade and transfers control to the protocol loop.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ws, err := s.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.Logger.Warn("Websocket upgrade failed", slog.Any("error", err))
		return
	}
	defer func() {
		_ = ws.Close()
	}()

	handler := newConnHandler(ws, s.Dialer, s.WriteQueueLen)
	handler.run()
}

type connHandler struct {
	// Underlying dialer for making connections
	dialer Dialer

	// WebSocket connection
	ws   *websocket.Conn
	wsMu sync.Mutex

	// Map of stream ID to active streams
	streams map[uint32]*serverStream
	closeCh chan uint32

	// Default write queue length
	writeQueueLen uint32

	// Context for this connection
	ctx    context.Context
	cancel context.CancelFunc
}

func newConnHandler(ws *websocket.Conn, dialer Dialer, writeQueueLen uint32) *connHandler {
	ctx, cancel := context.WithCancel(context.Background())
	return &connHandler{
		dialer: dialer,

		ws:   ws,
		wsMu: sync.Mutex{},

		streams: make(map[uint32]*serverStream),
		closeCh: make(chan uint32),

		writeQueueLen: writeQueueLen,

		ctx:    ctx,
		cancel: cancel,
	}
}

func (h *connHandler) run() {
	defer h.cancel()

	// Send initial CONTINUE packet
	err := h.writePacket(NewContinuePacket(0, h.writeQueueLen))
	if err != nil {
		return
	}

	for {
		h.closePending()

		_, p, err := h.ws.ReadMessage()
		if err != nil {
			break
		}

		packet, err := ParsePacket(p)
		if err != nil {
			_ = h.writePacket(NewClosePacket(0, CloseReasonInvalidInfo))
			return
		}

		switch packet.Type {
		case PacketTypeConnect:
			h.handleConnect(packet)
		case PacketTypeData:
			h.handleData(packet)
		case PacketTypeClose:
			h.handleClose(packet)
		default:
			// Invalid packet type
			_ = h.writePacket(NewClosePacket(0, CloseReasonInvalidInfo))
			return
		}
	}

	// Close any pending-closed streams
	h.closePending()

	// Cleanup all remaining streams
	for _, s := range h.streams {
		_, _ = s.cleanup(0)
	}

	h.streams = nil

	// Can't close closeCh. An atomic swap guards against double-closing, but
	// if a non-cleanup close wins the race, it's possible for the closeCh to
	// be sent on after we've closed it. So let's just let it be garbage
	// collected.
}

func (h *connHandler) closePending() {
	// Close pending-closed channels
	for {
		select {
		case streamID := <-h.closeCh:
			if stream, ok := h.streams[streamID]; ok {
				delete(h.streams, streamID)
				close(stream.writeQueue)
			}
		default:
			return
		}
	}
}

func (h *connHandler) writePacket(p Packet) error {
	data := SerializePacket(p)
	h.wsMu.Lock()
	defer h.wsMu.Unlock()
	return h.ws.WriteMessage(websocket.BinaryMessage, data)
}

func (h *connHandler) handleConnect(p Packet) {
	payload, err := ParseConnectPayload(p.Payload)
	if err != nil {
		_ = h.writePacket(NewClosePacket(p.StreamID, CloseReasonInvalidInfo))
		return
	}

	if _, exists := h.streams[p.StreamID]; exists {
		_ = h.writePacket(NewClosePacket(p.StreamID, CloseReasonInvalidInfo)) // Stream ID collision?
		return
	}

	// Dial
	var network string
	switch payload.StreamType {
	case StreamTypeTCP:
		network = "tcp"
	case StreamTypeUDP:
		network = "udp"
	default:
		_ = h.writePacket(NewClosePacket(p.StreamID, CloseReasonInvalidInfo))
		return
	}

	targetAddr := fmt.Sprintf("%s:%d", payload.Hostname, payload.Port)
	conn, err := h.dialer.Dial(network, targetAddr)
	if err != nil {
		reason := CloseReasonUnreachable
		var hostNotAllowed *ErrorHostNotAllowed
		if errors.As(err, &hostNotAllowed) {
			reason = CloseReasonBlocked
		}
		_ = h.writePacket(NewClosePacket(p.StreamID, reason))
		return
	}

	stream := &serverStream{
		handler:    h,
		streamID:   p.StreamID,
		conn:       conn,
		streamType: payload.StreamType,
		writeQueue: make(chan []byte, 1),
		readQueue:  make(chan []byte),
	}

	h.streams[p.StreamID] = stream

	remoteStr := conn.RemoteAddr().String()
	streamIdStr := strconv.FormatUint(uint64(p.StreamID), 10)
	pprof.Do(h.ctx, pprof.Labels(
		"wisp-server", "peer-read-loop",
		"remote", remoteStr,
		"stream-id", streamIdStr,
	), func(_ context.Context) {
		go stream.peerReadLoop()
	})
	pprof.Do(h.ctx, pprof.Labels(
		"wisp-server", "client-read-loop",
		"remote", remoteStr,
		"stream-id", streamIdStr,
	), func(_ context.Context) {
		go stream.clientReadLoop()
	})
	pprof.Do(h.ctx, pprof.Labels(
		"wisp-server", "peer-write-loop",
		"remote", remoteStr,
		"stream-id", streamIdStr,
	), func(_ context.Context) {
		go stream.peerWriteLoop()
	})
}

func (h *connHandler) handleData(p Packet) {
	if stream, ok := h.streams[p.StreamID]; ok {
		// SAFETY: writeQueue is closed before the stream is removed from the map.
		stream.writeQueue <- p.Payload
	}
}

func (h *connHandler) handleClose(p Packet) {
	if stream, ok := h.streams[p.StreamID]; ok {
		_, _ = stream.cleanup(0)
	}
}

type serverStream struct {
	handler    *connHandler
	conn       net.Conn
	streamID   uint32
	closed     atomic.Bool
	streamType uint8

	// Read queue for packets to be sent to the client
	readQueue chan []byte

	// Write queue for packets to be sent to the peer
	writeQueue chan []byte

	// Write packet counter
	counter uint32
}

func (s *serverStream) peerReadLoop() {
	buf1 := make([]byte, ReadBufferLen)
	buf2 := make([]byte, ReadBufferLen)
	defer func() {
		_ = s.close(CloseReasonVoluntary)
	}()
	defer close(s.readQueue)

	for {
		n, err := s.conn.Read(buf1)
		if err != nil {
			return
		}
		if n > 0 {
			// SAFETY: readQueue is only ever closed in the defer above.
			s.readQueue <- buf1[:n]
		}
		buf1, buf2 = buf2, buf1
	}
}

func (s *serverStream) clientReadLoop() {
	for data := range s.readQueue {
		err := s.handler.writePacket(NewDataPacket(s.streamID, data))
		if err != nil {
			_ = s.close(CloseReasonNetworkError)
			// Can't exit until readQueue is closed, otherwise peerReadLoop may
			// block.
			continue
		}
	}
}

func (s *serverStream) peerWriteLoop() {
	for {
		select {
		case <-s.handler.ctx.Done():
			return
		case data, ok := <-s.writeQueue:
			if !ok {
				return
			}
			_, err := s.conn.Write(data)
			if err != nil {
				_ = s.close(CloseReasonNetworkError)
				return
			}
			s.counter++
			// We don't actually use a queue. Just refill credits periodically.
			if s.counter > s.handler.writeQueueLen/2 {
				_ = s.handler.writePacket(NewContinuePacket(s.streamID, uint32(s.handler.writeQueueLen)))
				s.counter = 0
			}
		}
	}
}

func (s *serverStream) close(reason uint8) error {
	ok, err := s.cleanup(reason)
	if ok {
		s.handler.closeCh <- s.streamID
	}
	return err
}

func (s *serverStream) cleanup(reason uint8) (bool, error) {
	if s.closed.Swap(true) {
		return false, nil
	}
	if reason != 0 {
		_ = s.handler.writePacket(NewClosePacket(s.streamID, reason))
	}
	return true, s.conn.Close()
}
