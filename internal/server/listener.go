package server

import (
	"net"
	"os"
	"strconv"
)

func newListener(address, socket string, perms string) (net.Listener, error) {
	if socket != "" {
		listener, err := net.Listen("unix", socket)
		if err != nil {
			return listener, err
		}

		if perms != "" {
			i, err := strconv.ParseUint(perms, 8, 32)
			if err != nil {
				return listener, err
			}
			if err := os.Chmod(socket, os.FileMode(i)); err != nil {
				return listener, err
			}
		} else {
			if err := os.Chmod(socket, 0770); err != nil {
				return listener, err
			}
		}

		return listener, err
	} else if address != "" {
		return net.Listen("tcp", address)
	} else {
		return nil, nil
	}
}
