//go:build windows

package store

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	crypt32             = windows.NewLazySystemDLL("Crypt32.dll")
	procProtectData     = crypt32.NewProc("CryptProtectData")
	procUnprotectData   = crypt32.NewProc("CryptUnprotectData")
)

type dataBlob struct {
	cbData uint32
	pbData *byte
}

func newBlob(d []byte) *dataBlob {
	if len(d) == 0 {
		return &dataBlob{}
	}
	return &dataBlob{cbData: uint32(len(d)), pbData: &d[0]}
}

func (b *dataBlob) bytes() []byte {
	if b.pbData == nil {
		return nil
	}
	return unsafe.Slice(b.pbData, b.cbData)
}

// dpapEncrypt wraps CryptProtectData (CRYPTPROTECT_LOCAL_MACHINE).
func dpapEncrypt(plain []byte) ([]byte, error) {
	in := newBlob(plain)
	descUTF16, _ := windows.UTF16PtrFromString("ShieldAgentConfig")
	var out dataBlob
	ret, _, err := procProtectData.Call(
		uintptr(unsafe.Pointer(in)),
		uintptr(unsafe.Pointer(descUTF16)),
		0, 0, 0,
		0x04, // CRYPTPROTECT_LOCAL_MACHINE
		uintptr(unsafe.Pointer(&out)),
	)
	if ret == 0 {
		return nil, err
	}
	result := make([]byte, out.cbData)
	copy(result, out.bytes())
	_, _ = windows.LocalFree(windows.Handle(unsafe.Pointer(out.pbData)))
	return result, nil
}

// dpapDecrypt wraps CryptUnprotectData.
func dpapDecrypt(blob []byte) ([]byte, error) {
	in := newBlob(blob)
	var out dataBlob
	ret, _, err := procUnprotectData.Call(
		uintptr(unsafe.Pointer(in)),
		0, 0, 0, 0,
		0x04,
		uintptr(unsafe.Pointer(&out)),
	)
	if ret == 0 {
		return nil, err
	}
	result := make([]byte, out.cbData)
	copy(result, out.bytes())
	_, _ = windows.LocalFree(windows.Handle(unsafe.Pointer(out.pbData)))
	return result, nil
}
