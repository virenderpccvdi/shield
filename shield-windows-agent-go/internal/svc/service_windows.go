//go:build windows

package svc

import (
	"fmt"
	"log"
	"os"
	"time"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/eventlog"
	"golang.org/x/sys/windows/svc/mgr"

	"github.com/rstglobal/shield-agent/internal/config"
)

// windowsSvc implements the Windows service interface.
type windowsSvc struct{ agent *Agent }

func (ws *windowsSvc) Execute(args []string, r <-chan svc.ChangeRequest, changes chan<- svc.Status) (bool, uint32) {
	const cmdsAccepted = svc.AcceptStop | svc.AcceptShutdown
	changes <- svc.Status{State: svc.StartPending}

	ws.agent.Start()

	changes <- svc.Status{State: svc.Running, Accepts: cmdsAccepted}

	for c := range r {
		switch c.Cmd {
		case svc.Stop, svc.Shutdown:
			changes <- svc.Status{State: svc.StopPending}
			ws.agent.Stop()
			return false, 0
		default:
			log.Printf("[svc] unexpected control command: %d", c.Cmd)
		}
	}
	return false, 0
}

// RunService dispatches as a Windows service or debug foreground.
func RunService(debug bool) error {
	agent := NewAgent()
	if debug {
		return debugRun(agent)
	}
	return svc.Run(config.ServiceName, &windowsSvc{agent: agent})
}

func debugRun(agent *Agent) error {
	agent.Start()
	select {}
}

// ── Service management ────────────────────────────────────────────────────────

// InstallService installs the Shield Agent as a Windows service.
func InstallService() error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connect to SCM: %w", err)
	}
	defer m.Disconnect()

	// Check if already installed
	s, err := m.OpenService(config.ServiceName)
	if err == nil {
		s.Close()
		return fmt.Errorf("service %s already exists", config.ServiceName)
	}

	s, err = m.CreateService(config.ServiceName, exePath,
		mgr.Config{
			DisplayName:      config.ServiceDisplay,
			Description:      config.ServiceDesc,
			StartType:        mgr.StartAutomatic,
			ServiceStartName: "LocalSystem",
		},
		"svc", // arg that tells main() to run as service
	)
	if err != nil {
		return fmt.Errorf("create service: %w", err)
	}
	defer s.Close()

	_ = eventlog.InstallAsEventCreate(config.ServiceName, eventlog.Error|eventlog.Warning|eventlog.Info)
	fmt.Printf("[ok] Service %q installed.\n", config.ServiceName)
	return nil
}

// RemoveService stops and removes the Windows service.
func RemoveService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	s, err := m.OpenService(config.ServiceName)
	if err != nil {
		return fmt.Errorf("service %s not found", config.ServiceName)
	}
	defer s.Close()

	_, _ = s.Control(svc.Stop)
	time.Sleep(time.Second)

	if err := s.Delete(); err != nil {
		return err
	}
	_ = eventlog.Remove(config.ServiceName)
	fmt.Printf("[ok] Service %q removed.\n", config.ServiceName)
	return nil
}

// StartService starts the installed Windows service.
func StartService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()
	s, err := m.OpenService(config.ServiceName)
	if err != nil {
		return err
	}
	defer s.Close()
	return s.Start()
}

// StopService stops the Windows service.
func StopService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()
	s, err := m.OpenService(config.ServiceName)
	if err != nil {
		return err
	}
	defer s.Close()
	_, err = s.Control(svc.Stop)
	return err
}
