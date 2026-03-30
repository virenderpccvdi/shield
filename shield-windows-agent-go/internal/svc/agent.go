// Package svc contains the core agent loop shared between the Windows
// service runner and foreground (CLI) mode.
package svc

import (
	"log"
	"time"

	"github.com/rstglobal/shield-agent/internal/api"
	"github.com/rstglobal/shield-agent/internal/config"
	"github.com/rstglobal/shield-agent/internal/dns"
	"github.com/rstglobal/shield-agent/internal/store"
)

// Agent orchestrates the DNS stub, tamper watchdog, heartbeat and policy sync.
type Agent struct {
	store *store.SecureStore
	api   *api.Client
	stub  *dns.Stub
	stopCh chan struct{}
	origDNS map[string][]string
}

func NewAgent() *Agent {
	s := store.New(config.ConfigFile)
	return &Agent{
		store:  s,
		api:    api.New(s),
		stopCh: make(chan struct{}),
	}
}

func (a *Agent) Start() {
	log.Printf("[agent] %s v%s starting", config.AppName, config.AppVersion)

	if !a.api.IsPaired() {
		log.Printf("[agent] not paired — run: shield-agent pair <CODE>")
	} else {
		a.activateDNS()
	}

	go a.heartbeatLoop()
	go a.reportLoop()
	go a.policyLoop()

	log.Printf("[agent] running")
}

func (a *Agent) Stop() {
	log.Printf("[agent] stopping")
	close(a.stopCh)
	if a.stub != nil {
		a.stub.Stop()
	}
	// Remove NRPT policy first; fall back to restoring adapter DNS if needed
	if dns.NRPTActive() {
		dns.RemoveNRPT()
	} else if a.origDNS != nil {
		dns.RestoreAll(a.origDNS)
	}
}

func (a *Agent) activateDNS() {
	cid := a.api.DNSClientID()
	if cid == "" {
		return
	}
	a.stub = dns.NewStub(cid)
	go func() {
		if err := a.stub.Start(); err != nil {
			log.Printf("[dns] stub error: %v", err)
		}
	}()
	time.Sleep(500 * time.Millisecond)

	// Use NRPT (Group Policy DNS redirect) instead of per-adapter DNS changes.
	// NRPT is the official Windows mechanism used by VPN/Group Policy — AV treats
	// it as a legitimate admin action, not DNS hijacking.
	if err := dns.ApplyNRPT(); err != nil {
		log.Printf("[dns] NRPT failed, falling back to adapter DNS: %v", err)
		a.origDNS = dns.ApplyAll()
		go dns.StartWatchdog(a.stopCh)
	}
	log.Printf("[agent] DNS filtering active via NRPT (clientId=%s)", cid)
}

// ── Background loops ──────────────────────────────────────────────────────────

func (a *Agent) heartbeatLoop() {
	t := time.NewTicker(config.HeartbeatInterval * time.Second)
	defer t.Stop()
	for {
		select {
		case <-a.stopCh:
			return
		case <-t.C:
			if a.api.IsPaired() {
				a.api.SendHeartbeat(a.api.ProfileID(), a.api.DeviceID(), map[string]interface{}{
					"platform":     config.AgentPlatform,
					"agentVersion": config.AppVersion,
				})
			}
		}
	}
}

func (a *Agent) reportLoop() {
	t := time.NewTicker(config.ReportInterval * time.Second)
	defer t.Stop()
	for {
		select {
		case <-a.stopCh:
			return
		case <-t.C:
			// Future: drain DNS query queue and report
		}
	}
}

func (a *Agent) policyLoop() {
	t := time.NewTicker(config.PolicySyncInterval * time.Second)
	defer t.Stop()
	for {
		select {
		case <-a.stopCh:
			return
		case <-t.C:
			a.api.Reload()
			if !a.api.IsPaired() {
				continue
			}
			if a.stub == nil {
				a.activateDNS()
				continue
			}
			paused, _ := a.api.GetDNSStatus(a.api.ProfileID())
			if paused {
				log.Printf("[agent] DNS filtering paused by parent")
			}
			// Update client ID if it changed
			if cid := a.api.DNSClientID(); cid != a.stub.ClientID() {
				a.stub.SetClientID(cid)
				log.Printf("[agent] DNS client ID updated: %s", cid)
			}
		}
	}
}
