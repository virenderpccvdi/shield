//go:build !windows

package dns

import "log"

func GetAdapters() []string                  { return []string{"eth0"} }
func GetDNS(_ string) []string               { return nil }
func SetShieldDNS(adapter string)            { log.Printf("[dns] set DNS on %s (stub)", adapter) }
func RestoreDNS(_ string, _ []string)        {}
func ApplyAll() map[string][]string          { return nil }
func RestoreAll(_ map[string][]string)       {}
func StartWatchdog(_ <-chan struct{})         {}
