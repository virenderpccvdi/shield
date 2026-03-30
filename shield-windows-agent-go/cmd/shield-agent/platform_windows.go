//go:build windows

package main

import (
	"fmt"
	"os"

	"github.com/rstglobal/shield-agent/internal/svc"
	winsvc "golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"

	"github.com/rstglobal/shield-agent/internal/config"
)

func runWindowsService(debug bool) {
	if err := svc.RunService(debug); err != nil {
		fmt.Fprintf(os.Stderr, "[svc] %v\n", err)
		os.Exit(1)
	}
}

func installService() error  { return svc.InstallService() }
func uninstallService() error { return svc.RemoveService() }
func startService() error    { return svc.StartService() }
func stopService() error     { return svc.StopService() }

func mustAdmin() {
	// On Windows, SCM operations fail with "Access is denied" if not admin.
	// We let the underlying APIs surface that error rather than pre-checking.
}

func serviceStatus() string {
	m, err := mgr.Connect()
	if err != nil {
		return "unknown (SCM unavailable)"
	}
	defer m.Disconnect()
	s, err := m.OpenService(config.ServiceName)
	if err != nil {
		return "not installed"
	}
	defer s.Close()
	st, err := s.Query()
	if err != nil {
		return "unknown"
	}
	switch st.State {
	case winsvc.Running:
		return "running"
	case winsvc.Stopped:
		return "stopped"
	case winsvc.StartPending:
		return "starting"
	case winsvc.StopPending:
		return "stopping"
	default:
		return fmt.Sprintf("state=%d", st.State)
	}
}
