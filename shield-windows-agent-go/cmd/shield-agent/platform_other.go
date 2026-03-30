//go:build !windows

package main

import (
	"fmt"
	"os"
	"runtime"

	"github.com/rstglobal/shield-agent/internal/svc"
)

func runWindowsService(_ bool) {
	fmt.Fprintf(os.Stderr, "Windows service mode is only supported on Windows (current: %s)\n", runtime.GOOS)
	// In non-windows dev/CI, just start the agent directly
	a := svc.NewAgent()
	a.Start()
	select {}
}

func installService() error  { return fmt.Errorf("install only supported on Windows") }
func uninstallService() error { return fmt.Errorf("uninstall only supported on Windows") }
func startService() error    { return fmt.Errorf("start only supported on Windows") }
func stopService() error     { return fmt.Errorf("stop only supported on Windows") }
func mustAdmin()             {}

func serviceStatus() string { return "n/a (not Windows)" }
