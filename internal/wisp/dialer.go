package wisp

import (
	"fmt"
	"net"
	"strings"
)

// Dialer mocks the net.Dialer interface for Wisp usage
type Dialer interface {
	Dial(network, addr string) (net.Conn, error)
}

// BuiltinDialer is the default dialer implementation with host filtering.
type BuiltinDialer struct {
	AllowFunc func(host string) bool
	netDialer net.Dialer
}

// NewBuiltinDialer creates a new dialer.
func NewBuiltinDialer(allowFunc func(host string) bool) *BuiltinDialer {
	if allowFunc == nil {
		allowFunc = func(string) bool { return false }
	}
	return &BuiltinDialer{
		AllowFunc: allowFunc,
		netDialer: net.Dialer{},
	}
}

// Dial connects to the address.
func (d *BuiltinDialer) Dial(network, addr string) (net.Conn, error) {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}

	if !d.AllowFunc(host) {
		return nil, fmt.Errorf("host %s is not allowed", host)
	}

	return d.netDialer.Dial(network, addr)
}

// AllowAll is a helper that allows any host.
func AllowAll(host string) bool {
	return true
}

// Whitelist creates an AllowFunc from a list of patterns.
// The pattern can be an exact match or a suffix match.
// A suffix match, like "*.example.com", does not match "example.com".
// A suffix match matches any number of subdomains.
// A pattern of just "*" matches all hosts.
func Whitelist(patterns []string) func(host string) bool {
	return func(host string) bool {
		for _, p := range patterns {
			if match(p, host) {
				return true
			}
		}
		return false
	}
}

// match checks if host matches the pattern.
func match(pattern, host string) bool {
	if pattern == "*" {
		return true
	}

	// Exact match
	if pattern == host {
		return true
	}

	// Wildcard prefix: *.example.com
	if strings.HasPrefix(pattern, "*.") {
		suffix := pattern[1:] // .example.com
		if strings.HasSuffix(host, suffix) {
			return true
		}
	}

	return false
}
