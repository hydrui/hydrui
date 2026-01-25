package wisp

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegration(t *testing.T) {
	t.Parallel()

	// Start Echo Servers
	tcpEchoListener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer func() {
		err := tcpEchoListener.Close()
		require.NoError(t, err)
	}()
	go func() {
		for {
			conn, err := tcpEchoListener.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer func() {
					err := c.Close()
					require.NoError(t, err)
				}()
				_, _ = io.Copy(c, c)
			}(conn)
		}
	}()

	udpEchoConn, err := net.ListenPacket("udp", "127.0.0.1:0")
	require.NoError(t, err)
	defer func() {
		err := udpEchoConn.Close()
		require.NoError(t, err)
	}()
	go func() {
		buf := make([]byte, 2048)
		for {
			n, addr, err := udpEchoConn.ReadFrom(buf)
			if err != nil {
				return
			}
			_, _ = udpEchoConn.WriteTo(buf[:n], addr)
		}
	}()

	// Start Wisp Server
	dialer := NewBuiltinDialer(AllowAll)
	server := NewServer(dialer)
	wsServer := httptest.NewServer(server)
	defer wsServer.Close()

	// Connect Client
	clientUrl := "ws" + wsServer.URL[4:]
	client, err := NewClient(clientUrl)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = client.Connect(ctx)
	require.NoError(t, err)
	defer func() {
		err := client.Close()
		require.NoError(t, err)
	}()

	t.Run("TCP Echo", func(t *testing.T) {
		conn, err := client.Dial("tcp", tcpEchoListener.Addr().String())
		require.NoError(t, err)
		if err != nil {
			return
		}
		defer func() {
			err := conn.Close()
			require.NoError(t, err)
		}()

		msg := []byte("hello tcp")
		_, err = conn.Write(msg)
		require.NoError(t, err)

		buf := make([]byte, len(msg))
		_, err = io.ReadFull(conn, buf)
		require.NoError(t, err)
		assert.Equal(t, msg, buf)
	})

	t.Run("UDP Echo", func(t *testing.T) {
		conn, err := client.Dial("udp", udpEchoConn.LocalAddr().String())
		require.NoError(t, err)
		if err != nil {
			return
		}
		defer func() {
			err := conn.Close()
			require.NoError(t, err)
		}()

		msg := []byte("hello udp")
		_, err = conn.Write(msg)
		require.NoError(t, err)

		buf := make([]byte, len(msg))
		_, err = io.ReadFull(conn, buf)
		require.NoError(t, err)
		assert.Equal(t, msg, buf)
	})

	t.Run("Concurrent Streams", func(t *testing.T) {
		var wg sync.WaitGroup
		for i := range 10 {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()
				conn, err := client.Dial("tcp", tcpEchoListener.Addr().String())
				assert.NoError(t, err)
				if err != nil {
					return
				}
				defer func() {
					err := conn.Close()
					require.NoError(t, err)
				}()

				msg := fmt.Appendf(nil, "msg %d", id)
				_, err = conn.Write(msg)
				require.NoError(t, err)

				buf := make([]byte, len(msg))
				_, err = io.ReadFull(conn, buf)
				require.NoError(t, err)
				assert.Equal(t, msg, buf)
			}(i)
		}
		wg.Wait()
	})

	t.Run("Blocked Host", func(t *testing.T) {
		// Create a new server/client pair for this test with filtering
		filterDialer := NewBuiltinDialer(Whitelist([]string{"*.example.com"}))
		fServer := NewServer(filterDialer)
		fWsServer := httptest.NewServer(fServer)
		defer fWsServer.Close()

		fClient, err := NewClient("ws" + fWsServer.URL[4:])
		require.NoError(t, err)
		require.NoError(t, fClient.Connect(ctx))
		defer func() {
			err := fClient.Close()
			require.NoError(t, err)
		}()

		// Try dialing local echo server (should be blocked)
		conn, err := fClient.Dial("tcp", tcpEchoListener.Addr().String())
		require.NoError(t, err) // Dial returns stream

		// Write might succeed
		_, _ = conn.Write([]byte("test"))

		// Read should fail
		buf := make([]byte, 10)
		_, err = conn.Read(buf)
		assert.Error(t, err)
	})

	t.Run("Flow Control", func(t *testing.T) {
		// Server with small buffer (e.g. 5 packets)
		smallBufDialer := NewBuiltinDialer(AllowAll)
		s := NewServer(smallBufDialer, WithWriteQueueLen(5))
		wsServer := httptest.NewServer(s)
		defer wsServer.Close()

		c, err := NewClient("ws" + wsServer.URL[4:])
		require.NoError(t, err)
		err = c.Connect(ctx)
		require.NoError(t, err)
		defer func() {
			err := c.Close()
			require.NoError(t, err)
		}()

		conn, err := c.Dial("tcp", tcpEchoListener.Addr().String())
		require.NoError(t, err)
		defer func() {
			err := conn.Close()
			require.NoError(t, err)
		}()

		// Send more than 5 packets.
		for range 20 {
			_, err := conn.Write([]byte("data"))
			assert.NoError(t, err)
		}
	})

	t.Run("Dial Unreachable", func(t *testing.T) {
		conn, err := client.Dial("tcp", "127.0.0.1:1") // Port 1 usually closed
		require.NoError(t, err)

		// Initial write can succeed
		_, _ = conn.Write([]byte("test"))

		// First read is guaranteed to fail
		buf := make([]byte, 1024)
		_, err = conn.Read(buf)
		assert.Error(t, err)
	})

	t.Run("HTTP POST", func(t *testing.T) {
		targetServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, _ := io.ReadAll(r.Body)
			_, _ = w.Write(body)
		}))
		defer targetServer.Close()

		s := NewServer(NewBuiltinDialer(AllowAll))
		wsServer := httptest.NewServer(s)
		defer wsServer.Close()

		c, err := NewClient("ws" + wsServer.URL[4:])
		require.NoError(t, err)
		err = c.Connect(ctx)
		require.NoError(t, err)
		defer func() {
			err := c.Close()
			require.NoError(t, err)
		}()

		client := &http.Client{
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					return c.Dial("tcp", addr)
				},
			},
		}
		req, err := http.NewRequest("POST", targetServer.URL, bytes.NewReader([]byte("test")))
		require.NoError(t, err)
		resp, err := client.Do(req)
		require.NoError(t, err)
		defer func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		}()
		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, "test", string(body))
	})
}
