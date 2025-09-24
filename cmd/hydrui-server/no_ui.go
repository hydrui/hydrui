//go:build !windows

package main

import "context"

func startUI(context.Context) bool {
	return false
}
