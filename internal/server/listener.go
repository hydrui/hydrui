package server

import "net"

func newListener(address, socket string) (net.Listener, error) {
	if address != "" {
		return net.Listen("tcp", address)
	} else if socket != "" {
		return net.Listen("unix", socket)
	} else {
		return nil, nil
	}
}
