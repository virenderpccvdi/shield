//go:build !windows

package dns

func ApplyNRPT() error  { return nil }
func RemoveNRPT()       {}
func NRPTActive() bool  { return false }
