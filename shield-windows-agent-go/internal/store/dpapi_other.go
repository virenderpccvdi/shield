//go:build !windows

package store

// On non-Windows platforms DPAPI is unavailable; AES fallback is used instead.
func dpapEncrypt(plain []byte) ([]byte, error) { return aesEncrypt(machineKey(), plain) }
func dpapDecrypt(blob []byte) ([]byte, error)  { return aesDecrypt(machineKey(), blob) }
