package bugreport

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math/rand/v2"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hydrui/hydrui/internal/crypt"
	"github.com/minio/minio-go/v7"
)

// Bug reports can contain huge files (i.e. sending broken PSDs)
// May need to adjust these values over time to strike a good balance.
const (
	maxMessageLength  = 1 << 14
	maxContentLength  = 1 << 28
	metadataTimeout   = 5 * time.Second
	messageTimeout    = 30 * time.Second
	connectionTimeout = 30 * time.Minute
)

var upgrader = websocket.Upgrader{
	HandshakeTimeout: 5 * time.Second,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type incomingMetadataMessage struct {
	ContentLength int64 `json:"contentLength"`
}

type embeddedMetadata struct {
	Subnet        string `json:"subnet"`
	ContentLength int64  `json:"contentLength"`
}

type errorMessage struct {
	Error string `json:"error"`
}

type successMessage struct {
	Success bool `json:"success"`
}

// handler is an HTTP handler that accepts bug reports over WebSockets.
type handler struct {
	minioClient   *minio.Client
	storagePrefix string
	storageBucket string
	recipient     *[32]byte
	logger        *slog.Logger
}

func NewHandler(
	minioClient *minio.Client,
	storagePrefix string,
	storageBucket string,
	recipient *[32]byte,
	logger *slog.Logger,
) http.Handler {
	return &handler{
		minioClient,
		storagePrefix,
		storageBucket,
		recipient,
		logger,
	}
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Record the IPv4 /24 and IPv6 /64 of the request.
	// Hopefully a reasonable trade-off for privacy and anti-abuse
	// (if there's ever a need to block ranges.)
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		panic(err)
	}
	addr, err := netip.ParseAddr(host)
	if err != nil {
		panic(err)
	}
	var subnet string
	if addr.Is4() || addr.Is4In6() {
		maskedAddr := [4]byte{}
		copy(maskedAddr[:], addr.AsSlice()[:3])
		subnet = netip.PrefixFrom(netip.AddrFrom4(maskedAddr), 24).String()
	} else {
		maskedAddr := [16]byte{}
		copy(maskedAddr[:], addr.AsSlice()[:8])
		subnet = netip.PrefixFrom(netip.AddrFrom16(maskedAddr), 64).String()
	}

	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.LogAttrs(r.Context(), slog.LevelDebug, "WebSocket Upgrade failed.", slog.Any("error", err))
		return
	}
	defer func() {
		if err := c.Close(); err != nil {
			h.logger.LogAttrs(r.Context(), slog.LevelDebug, "Error closing WebSocket connection.", slog.Any("error", err))
			return
		}
	}()
	c.SetReadLimit(maxMessageLength)
	_ = c.SetReadDeadline(time.Now().Add(metadataTimeout))

	sendError := func(msg string) {
		if err := c.WriteJSON(errorMessage{Error: msg}); err != nil {
			h.logger.LogAttrs(r.Context(), slog.LevelDebug, "Sending WebSocket error failed.", slog.Any("error", err))
		}
		if err := c.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseMessage, "Error receiving report."), time.Now().Add(5*time.Second)); err != nil {
			h.logger.LogAttrs(r.Context(), slog.LevelDebug, "Sending WebSocket close message failed.", slog.Any("error", err))
		}
	}

	incomingMetadata := incomingMetadataMessage{}
	if err := c.ReadJSON(&incomingMetadata); err != nil {
		sendError("Invalid metadata.")
		return
	}

	contentLength := incomingMetadata.ContentLength
	if contentLength <= 0 {
		sendError("Invalid payload size.")
		return
	} else if contentLength > maxContentLength {
		sendError("Payload too large.")
		return
	}

	// Encode the request data we want to collect.
	metadata, err := json.Marshal(embeddedMetadata{
		Subnet:        subnet,
		ContentLength: contentLength,
	})
	if err != nil {
		h.logger.LogAttrs(r.Context(), slog.LevelError, "Failed to marshal embedded metadata structure.", slog.Any("error", err))
		sendError("Internal error.")
		return
	}

	data := io.LimitReader(&websocketReader{conn: c}, contentLength)

	// While writing the report to storage, we encapsulate it and encrypt it a
	// second time, for good measure.
	objectName := fmt.Sprintf(
		"%s-%s-%08x.bin",
		h.storagePrefix,
		time.Now().Format(time.RFC3339),
		rand.Uint32(),
	)
	_, err = h.minioClient.PutObject(
		r.Context(),
		h.storageBucket,
		objectName,
		generateReportObject(metadata, data, h.recipient),
		calculateReportObjectSize(int64(len(metadata)), contentLength),
		minio.PutObjectOptions{},
	)
	if err != nil {
		h.logger.LogAttrs(r.Context(), slog.LevelError, "Failed to store object in object storage.", slog.Any("error", err))
		sendError("Internal error.")
		return
	}
	if err := c.WriteJSON(successMessage{Success: true}); err != nil {
		h.logger.LogAttrs(r.Context(), slog.LevelDebug, "Sending WebSocket success message failed.", slog.Any("error", err))
	}
	if err := c.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(5*time.Second)); err != nil {
		h.logger.LogAttrs(r.Context(), slog.LevelDebug, "Sending WebSocket close message failed.", slog.Any("error", err))
	}
}

// websocketReader implements an [io.Reader] that reads WebSocket messages from
// a Gorilla WebSocket connection and treats it as a contiguous stream of data.
type websocketReader struct {
	conn  *websocket.Conn
	frame io.Reader
}

// Read implements [io.Reader].
func (r *websocketReader) Read(buf []byte) (n int, err error) {
	for n < len(buf) && err == nil {
		if r.frame == nil {
			_ = r.conn.SetReadDeadline(time.Now().Add(messageTimeout))
			_, r.frame, err = r.conn.NextReader()
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
				return n, io.EOF
			}
			if err != nil {
				break
			}
		}
		for n < len(buf) && err == nil {
			var nn int
			nn, err = r.frame.Read(buf[n:])
			n += nn
		}
		if err == io.EOF {
			r.frame, err = nil, nil
		}
	}
	return
}

func calculateReportObjectSize(metadataSize int64, dataSize int64) int64 {
	return (20 +
		crypt.Size(metadataSize) +
		8 +
		crypt.Size(dataSize) +
		8)
}

func generateReportObject(metadata []byte, data io.Reader, recipient *[32]byte) io.Reader {
	return io.MultiReader(
		strings.NewReader("EncryptedReport\x00Meta"),
		crypt.EncryptReader(bytes.NewReader(metadata), recipient),
		strings.NewReader("\x00\x00\x00\x00Data"),
		crypt.EncryptReader(data, recipient),
		strings.NewReader("\x00\x00\x00\x00EOF\x00"),
	)
}
