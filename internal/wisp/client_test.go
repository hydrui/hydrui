package wisp

import (
	"os"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClient(t *testing.T) {
	t.Parallel()

	t.Run("Write Deadline", func(t *testing.T) {
		t.Parallel()

		if testing.Short() {
			t.Skip("skipping test in short mode")
		}

		synctest.Test(t, func(t *testing.T) {
			// Manually construct client/stream to test blocking behavior
			c, _ := NewClient("ws://mock")
			s := newClientStream(c, 1, StreamTypeTCP)

			// Set Deadline
			err := s.SetWriteDeadline(time.Now().Add(time.Second))
			require.NoError(t, err)

			// Trigger the deadline
			start := time.Now()
			_, err = s.Write([]byte("foo"))
			assert.True(t, time.Since(start) == time.Second)
			assert.ErrorIs(t, err, os.ErrDeadlineExceeded)
		})
	})

	t.Run("Read Deadline", func(t *testing.T) {
		t.Parallel()

		if testing.Short() {
			t.Skip("skipping test in short mode")
		}

		synctest.Test(t, func(t *testing.T) {
			// Manually construct client/stream to test blocking behavior
			c, err := NewClient("ws://mock")
			s := newClientStream(c, 1, StreamTypeTCP)
			require.NoError(t, err)
			defer func() {
				err := c.Close()
				require.NoError(t, err)
			}()

			// Set Deadline
			err = s.SetReadDeadline(time.Now().Add(time.Second))
			require.NoError(t, err)

			// Trigger the deadline
			buf := make([]byte, 10)
			start := time.Now()
			_, err = s.Read(buf)
			assert.True(t, time.Since(start) == time.Second)
			assert.ErrorIs(t, err, os.ErrDeadlineExceeded)
		})
	})
}
