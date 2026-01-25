package wisp

import (
	"net"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDialer(t *testing.T) {
	t.Parallel()

	t.Run("Default Safe", func(t *testing.T) {
		t.Parallel()

		d := NewBuiltinDialer(nil)
		_, err := d.Dial("tcp", "example.com:80")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not allowed")
	})

	t.Run("Whitelist Wildcard", func(t *testing.T) {
		t.Parallel()

		allow := Whitelist([]string{"*"})
		assert.True(t, allow("example.com"))
		assert.True(t, allow("google.com"))
	})

	t.Run("Whitelist Exact", func(t *testing.T) {
		t.Parallel()

		allow := Whitelist([]string{"example.com"})
		assert.True(t, allow("example.com"))
		assert.False(t, allow("a.example.com"))
	})

	t.Run("Whitelist Suffix", func(t *testing.T) {
		t.Parallel()

		allow := Whitelist([]string{"*.example.com"})
		assert.True(t, allow("a.example.com"))
		assert.True(t, allow("b.a.example.com"))
		assert.False(t, allow("example.com"))
	})

	t.Run("Dialer Split Error", func(t *testing.T) {
		t.Parallel()

		d := NewBuiltinDialer(AllowAll)
		_, err := d.Dial("tcp", "missing-port")
		assert.Error(t, err)
		assert.IsType(t, &net.AddrError{}, err)
	})
}
