//go:build windows

package dns

import (
	"log"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/windows/registry"
)

const (
	shieldDNS     = "127.0.0.1"
	interfacesKey = `SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces`
)

// Windows DNS API — flush resolver cache after any DNS change.
var (
	dnsapi        = syscall.NewLazyDLL("dnsapi.dll")
	procFlushCache = dnsapi.NewProc("DnsFlushResolverCache")
)

func flushDNSCache() { procFlushCache.Call() } //nolint

// ── Adapter enumeration ───────────────────────────────────────────────────────

// GetAdapters returns registry GUIDs of network interfaces that have an IP address.
func GetAdapters() []string {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, interfacesKey, registry.ENUMERATE_SUB_KEYS)
	if err != nil {
		return nil
	}
	defer k.Close()

	guids, _ := k.ReadSubKeyNames(-1)
	var active []string
	for _, guid := range guids {
		if hasIP(guid) {
			active = append(active, guid)
		}
	}
	return active
}

func hasIP(guid string) bool {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, interfacesKey+`\`+guid, registry.READ)
	if err != nil {
		return false
	}
	defer k.Close()

	// DHCP-assigned address
	dhcp, _, _ := k.GetStringValue("DhcpIPAddress")
	if dhcp != "" && dhcp != "0.0.0.0" {
		return true
	}
	// Static addresses (multi-string value)
	addrs, _, _ := k.GetStringsValue("IPAddress")
	for _, a := range addrs {
		if a != "" && a != "0.0.0.0" {
			return true
		}
	}
	return false
}

// ── DNS read/write ────────────────────────────────────────────────────────────

// GetDNS returns the current NameServer value for an interface GUID.
func GetDNS(guid string) []string {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, interfacesKey+`\`+guid, registry.READ)
	if err != nil {
		return nil
	}
	defer k.Close()

	val, _, err := k.GetStringValue("NameServer")
	if err != nil || val == "" {
		return nil
	}
	return strings.Split(val, ",")
}

// SetShieldDNS sets the Shield local stub (127.0.0.1) as the DNS server.
func SetShieldDNS(guid string) {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, interfacesKey+`\`+guid, registry.SET_VALUE)
	if err != nil {
		log.Printf("[dns] cannot open registry key for %s: %v", guid, err)
		return
	}
	defer k.Close()

	if err := k.SetStringValue("NameServer", shieldDNS); err != nil {
		log.Printf("[dns] cannot set NameServer for %s: %v", guid, err)
		return
	}
	log.Printf("[dns] Shield DNS set on %s", guid)
	flushDNSCache()
}

// RestoreDNS restores the original DNS servers for an interface GUID.
func RestoreDNS(guid string, original []string) {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, interfacesKey+`\`+guid, registry.SET_VALUE)
	if err != nil {
		return
	}
	defer k.Close()

	// Empty original means DHCP — clear the static override
	if len(original) == 0 {
		k.SetStringValue("NameServer", "")
	} else {
		k.SetStringValue("NameServer", strings.Join(original, ","))
	}
	flushDNSCache()
}

// ── Bulk helpers ──────────────────────────────────────────────────────────────

// ApplyAll sets Shield DNS on all active adapters and returns the original DNS map.
func ApplyAll() map[string][]string {
	originals := make(map[string][]string)
	for _, guid := range GetAdapters() {
		originals[guid] = GetDNS(guid)
		SetShieldDNS(guid)
	}
	return originals
}

// RestoreAll restores DNS on all adapters.
func RestoreAll(originals map[string][]string) {
	for guid, dns := range originals {
		RestoreDNS(guid, dns)
	}
}

// ── Tamper watchdog ───────────────────────────────────────────────────────────

// StartWatchdog periodically checks that DNS hasn't been changed and restores it.
func StartWatchdog(stopCh <-chan struct{}) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			checkAndRestore()
		}
	}
}

func checkAndRestore() {
	for _, guid := range GetAdapters() {
		current := GetDNS(guid)
		if len(current) > 0 && current[0] != shieldDNS {
			log.Printf("[dns] tamper detected on %s (was %v) — restoring", guid, current)
			SetShieldDNS(guid)
		}
	}
}
