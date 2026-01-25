package wisp

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"runtime/pprof"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// Client represents a Wisp client that connects to a Wisp server.
type Client struct {
	url        string
	ws         *websocket.Conn
	writeMu    sync.Mutex
	streams    map[uint32]*clientStream
	streamsMu  sync.RWMutex
	nextID     uint32
	ctx        context.Context
	cancel     context.CancelFunc
	initBuffer uint32
	closed     atomic.Bool
	ready      chan struct{} // Closed when initial CONTINUE packet is received
}

// NewClient creates a new Wisp client.
func NewClient(url string) (*Client, error) {
	ctx, cancel := context.WithCancel(context.Background())
	return &Client{
		url:     url,
		streams: make(map[uint32]*clientStream),
		nextID:  1, // Stream ID 0 is reserved
		ctx:     ctx,
		cancel:  cancel,
		ready:   make(chan struct{}),
	}, nil
}

// Connect establishes the WebSocket connection and starts the read loop.
func (c *Client) Connect(ctx context.Context) error {
	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}
	conn, _, err := dialer.DialContext(ctx, c.url, nil)
	if err != nil {
		return err
	}
	c.ws = conn

	// Start read loop
	pprof.Do(ctx, pprof.Labels("wisp-client", "read-loop", "url", c.url), func(_ context.Context) {
		go c.readLoop()
	})

	// Wait for initial CONTINUE packet
	select {
	case <-c.ready:
		return nil
	case <-ctx.Done():
		return errors.Join(ctx.Err(), c.Close())
	case <-time.After(10 * time.Second):
		return errors.Join(errors.New("timeout waiting for initial CONTINUE packet"), c.Close())
	}
}

// Dial creates a new stream to the specified address.
// Network can be "tcp" or "udp".
func (c *Client) Dial(network, addr string) (net.Conn, error) {
	if c.closed.Load() {
		return nil, errors.New("client is closed")
	}

	host, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	port, err := strconv.ParseUint(portStr, 10, 16)
	if err != nil {
		return nil, err
	}

	streamType := StreamTypeTCP
	if network == "udp" {
		streamType = StreamTypeUDP
	}

	streamID := atomic.AddUint32(&c.nextID, 1)

	stream := newClientStream(c, streamID, streamType)
	stream.bufferRemaining = int32(c.initBuffer)

	c.streamsMu.Lock()
	c.streams[streamID] = stream
	c.streamsMu.Unlock()

	// Send CONNECT packet
	payload := ConnectPayload{
		StreamType: streamType,
		Port:       uint16(port),
		Hostname:   host,
	}
	err = c.writePacket(Packet{
		Type:     PacketTypeConnect,
		StreamID: streamID,
		Payload:  SerializeConnectPayload(payload),
	})
	if err != nil {
		c.removeStream(streamID)
		return nil, err
	}

	return stream, nil
}

func (c *Client) Close() (err error) {
	if c.closed.Swap(true) {
		return err
	}
	c.cancel()
	if c.ws != nil {
		err = c.ws.Close()
	}
	c.streamsMu.Lock()
	defer c.streamsMu.Unlock()
	for _, s := range c.streams {
		s.closeInternal()
	}
	// Clear map
	c.streams = make(map[uint32]*clientStream)
	return err
}

func (c *Client) writePacket(p Packet) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.ws.WriteMessage(websocket.BinaryMessage, SerializePacket(p))
}

func (c *Client) readLoop() {
	for {
		_, p, err := c.ws.ReadMessage()
		if err != nil {
			return
		}
		packet, err := ParsePacket(p)
		if err != nil {
			return
		}

		if packet.StreamID == 0 {
			if packet.Type == PacketTypeContinue {
				payload, err := ParseContinuePayload(packet.Payload)
				if err == nil {
					c.initBuffer = payload.BufferRemaining
					select {
					case <-c.ready:
					default:
						close(c.ready)
					}
				}
			}
			continue
		}

		c.streamsMu.RLock()
		stream, ok := c.streams[packet.StreamID]
		c.streamsMu.RUnlock()

		if !ok {
			// Stream not found, maybe closed already.
			if packet.Type == PacketTypeClose {
				continue // Ignore close on unknown stream
			}
			_ = c.writePacket(NewClosePacket(packet.StreamID, CloseReasonClientUnexpectedErr))
			continue
		}

		switch packet.Type {
		case PacketTypeData:
			stream.receiveData(packet.Payload)
		case PacketTypeContinue:
			payload, err := ParseContinuePayload(packet.Payload)
			if err == nil {
				stream.updateBuffer(payload.BufferRemaining)
			}
		case PacketTypeClose:
			payload, _ := ParseClosePayload(packet.Payload)
			stream.remoteClosed(payload.Reason)
			c.removeStream(packet.StreamID)
		}
	}
}

func (c *Client) removeStream(id uint32) {
	c.streamsMu.Lock()
	delete(c.streams, id)
	c.streamsMu.Unlock()
}

// clientStream implements net.Conn
type clientStream struct {
	client     *Client
	streamID   uint32
	streamType uint8

	// Read buffer
	readCh  chan []byte
	readBuf []byte

	// Flow control
	bufferRemaining int32 // Atomic
	bufferUpdateCh  chan struct{}

	// Deadlines
	readDeadline  atomic.Value // time.Time
	writeDeadline atomic.Value // time.Time

	// State
	closed   atomic.Bool
	closeErr atomic.Pointer[error]
	mu       sync.Mutex
}

func newClientStream(client *Client, id uint32, streamType uint8) *clientStream {
	s := &clientStream{
		client:         client,
		streamID:       id,
		streamType:     streamType,
		readCh:         make(chan []byte, 100),
		bufferUpdateCh: make(chan struct{}),
	}
	// Initialize deadline values with zero time
	s.readDeadline.Store(time.Time{})
	s.writeDeadline.Store(time.Time{})
	return s
}

func (s *clientStream) Read(b []byte) (n int, err error) {
	if len(s.readBuf) > 0 {
		n = copy(b, s.readBuf)
		s.readBuf = s.readBuf[n:]
		return n, nil
	}

	if s.closed.Load() {
		return 0, io.ErrClosedPipe
	}

	if closeErr := s.closeErr.Load(); closeErr != nil && len(s.readCh) == 0 {
		return 0, *closeErr
	}

	var timeout <-chan time.Time
	if d, ok := s.readDeadline.Load().(time.Time); ok && !d.IsZero() {
		if time.Now().After(d) {
			return 0, os.ErrDeadlineExceeded
		}
		timer := time.NewTimer(time.Until(d))
		defer timer.Stop()
		timeout = timer.C
	}

	select {
	case data, ok := <-s.readCh:
		if !ok {
			if closeErr := s.closeErr.Load(); closeErr != nil {
				return 0, *closeErr
			}
			return 0, io.EOF
		}
		n = copy(b, data)
		if n < len(data) {
			s.readBuf = data[n:]
		}
		return n, nil
	case <-s.client.ctx.Done():
		return 0, io.ErrClosedPipe
	case <-timeout:
		return 0, os.ErrDeadlineExceeded
	}
}

func (s *clientStream) Write(b []byte) (n int, err error) {
	if s.closed.Load() || s.closeErr.Load() != nil {
		return 0, io.ErrClosedPipe
	}

	// UDP doesn't use flow control
	if s.streamType == StreamTypeUDP {
		err := s.client.writePacket(NewDataPacket(s.streamID, b))
		if err != nil {
			return 0, err
		}
		return len(b), nil
	}

	// TCP Flow Control
	for {
		if s.closed.Load() || s.closeErr.Load() != nil {
			return 0, io.ErrClosedPipe
		}

		// Check deadline
		if d, ok := s.writeDeadline.Load().(time.Time); ok && !d.IsZero() {
			if time.Now().After(d) {
				return 0, os.ErrDeadlineExceeded
			}
		}

		rem := atomic.LoadInt32(&s.bufferRemaining)
		if rem > 0 {
			if atomic.CompareAndSwapInt32(&s.bufferRemaining, rem, rem-1) {
				break
			}
			continue
		}

		// Wait for update
		s.mu.Lock()
		ch := s.bufferUpdateCh
		s.mu.Unlock()

		var timeout <-chan time.Time
		if d, ok := s.writeDeadline.Load().(time.Time); ok && !d.IsZero() {
			timer := time.NewTimer(time.Until(d))
			defer timer.Stop()
			timeout = timer.C
		}

		select {
		case <-ch:
			// Retry loop
		case <-s.client.ctx.Done():
			return 0, io.ErrClosedPipe
		case <-timeout:
			return 0, os.ErrDeadlineExceeded
		}
	}

	err = s.client.writePacket(NewDataPacket(s.streamID, b))
	if err != nil {
		return 0, err
	}
	return len(b), nil
}

func (s *clientStream) Close() error {
	return s.closeWithReason(CloseReasonVoluntary)
}

func (s *clientStream) closeWithReason(reason uint8) error {
	if s.closed.Swap(true) {
		return nil
	}
	_ = s.client.writePacket(NewClosePacket(s.streamID, reason))
	s.client.removeStream(s.streamID)
	s.closeInternal()
	return nil
}

func (s *clientStream) closeInternal() {
	s.mu.Lock()
	close(s.bufferUpdateCh)
	s.bufferUpdateCh = make(chan struct{})
	s.mu.Unlock()
}

func (s *clientStream) receiveData(data []byte) {
	if s.closed.Load() || s.closeErr.Load() != nil {
		return
	}
	// Make a copy since buffer reuse might happen at lower levels (websocket)
	d := make([]byte, len(data))
	copy(d, data)

	select {
	case s.readCh <- d:
	case <-s.client.ctx.Done():
	}
}

func (s *clientStream) updateBuffer(val uint32) {
	s.mu.Lock()
	atomic.StoreInt32(&s.bufferRemaining, int32(val))
	close(s.bufferUpdateCh)
	s.bufferUpdateCh = make(chan struct{})
	s.mu.Unlock()
}

func (s *clientStream) remoteClosed(reason uint8) {
	var err error
	if reason != CloseReasonVoluntary {
		err = fmt.Errorf("remote closed with reason: %d", reason)
	} else {
		err = io.EOF
	}
	s.closeErr.Store(&err)
	close(s.readCh)
	s.closeInternal()
}

func (s *clientStream) LocalAddr() net.Addr {
	return &wispAddr{s.client.url, s.streamID}
}

func (s *clientStream) RemoteAddr() net.Addr {
	return &wispAddr{"remote", s.streamID}
}

func (s *clientStream) SetDeadline(t time.Time) error {
	s.readDeadline.Store(t)
	s.writeDeadline.Store(t)
	return nil
}

func (s *clientStream) SetReadDeadline(t time.Time) error {
	s.readDeadline.Store(t)
	return nil
}

func (s *clientStream) SetWriteDeadline(t time.Time) error {
	s.writeDeadline.Store(t)
	return nil
}

type wispAddr struct {
	host string
	id   uint32
}

func (a *wispAddr) Network() string { return "wisp" }
func (a *wispAddr) String() string  { return fmt.Sprintf("%s:%d", a.host, a.id) }
