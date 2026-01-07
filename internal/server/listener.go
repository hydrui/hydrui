package server

import "net"

func newListener(address, socket string) (net.Listener, error) {
	if socket != "" {
		return net.Listen("unix", socket)
	} else if address != "" {
		return net.Listen("tcp", address)
	} else {
		return nil, nil
	}
}
