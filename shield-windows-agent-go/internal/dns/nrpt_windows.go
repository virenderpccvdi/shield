//go:build windows

// Package dns — NRPT (Name Resolution Policy Table) management.
//
// NRPT is the official Windows mechanism used by Group Policy and VPN clients
// to redirect DNS queries. Writing to this registry path is treated by Windows
// exactly like a Group Policy application — much less likely to trigger
// behavior-based AV detection than modifying per-adapter DNS settings.
//
// Registry path:
//   HKLM\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient\DnsPolicy\<Name>\
//     Namespace          = "."   (all domains)
//     GenericDNSServers  = "127.0.0.1"
//     Version            = 1

package dns

import (
	"log"

	"golang.org/x/sys/windows/registry"
)

const (
	nrptBase       = `SOFTWARE\Policies\Microsoft\Windows NT\DNSClient\DnsPolicy`
	nrptPolicyName = "ShieldParentalControl"
	nrptComment    = "Shield Parental Control DNS Policy - do not remove"
)

// ApplyNRPT creates the NRPT policy entry that redirects all DNS to 127.0.0.1.
// This is the Group Policy / VPN-style approach — recognized as legitimate
// admin policy by AV products, unlike per-adapter NameServer changes.
func ApplyNRPT() error {
	keyPath := nrptBase + `\` + nrptPolicyName
	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, keyPath, registry.SET_VALUE|registry.CREATE_SUB_KEY)
	if err != nil {
		return err
	}
	defer k.Close()

	if err := k.SetStringValue("Namespace", "."); err != nil {
		return err
	}
	if err := k.SetStringValue("GenericDNSServers", shieldDNS); err != nil {
		return err
	}
	if err := k.SetDWordValue("Version", 1); err != nil {
		return err
	}
	if err := k.SetDWordValue("DirectAccessEnabled", 0); err != nil {
		return err
	}
	if err := k.SetStringValue("Comment", nrptComment); err != nil {
		return err
	}

	flushDNSCache()
	log.Printf("[dns] NRPT policy applied → all DNS routed through %s", shieldDNS)
	return nil
}

// RemoveNRPT deletes the NRPT policy entry, restoring normal DNS resolution.
func RemoveNRPT() {
	keyPath := nrptBase + `\` + nrptPolicyName
	if err := registry.DeleteKey(registry.LOCAL_MACHINE, keyPath); err != nil {
		log.Printf("[dns] NRPT remove: %v", err)
		return
	}
	flushDNSCache()
	log.Printf("[dns] NRPT policy removed — DNS restored to system default")
}

// NRPTActive returns true if the Shield NRPT policy is currently installed.
func NRPTActive() bool {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, nrptBase+`\`+nrptPolicyName, registry.READ)
	if err != nil {
		return false
	}
	k.Close()
	return true
}
