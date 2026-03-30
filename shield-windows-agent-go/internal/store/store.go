// Package store provides encrypted persistent credential storage.
// On Windows it uses DPAPI (CryptProtectData) via syscall so only
// the SYSTEM account can decrypt the blob.
package store

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"runtime"
)

// AgentConfig holds all persisted agent state.
type AgentConfig struct {
	Email       string `json:"email,omitempty"`
	AccessToken string `json:"access_token,omitempty"`
	TokenExp    int64  `json:"token_exp,omitempty"`
	ProfileID   string `json:"profile_id,omitempty"`
	DNSClientID string `json:"dns_client_id,omitempty"`
	DeviceID    string `json:"device_id,omitempty"`
	ChildName   string `json:"child_name,omitempty"`
}

// SecureStore encrypts config using DPAPI (Windows) or AES-256-GCM fallback.
type SecureStore struct {
	path string
}

func New(path string) *SecureStore {
	_ = os.MkdirAll(filepath.Dir(path), 0700)
	return &SecureStore{path: path}
}

func (s *SecureStore) Save(cfg *AgentConfig) error {
	data, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	encrypted, err := encrypt(data)
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, encrypted, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func (s *SecureStore) Load() (*AgentConfig, error) {
	// Check for plaintext bootstrap written by the PowerShell installer.
	// If found, absorb it into the encrypted store and delete it.
	bootstrapPath := filepath.Join(filepath.Dir(s.path), "bootstrap.json")
	if _, err2 := os.Stat(bootstrapPath); err2 == nil {
		if raw, err2 := os.ReadFile(bootstrapPath); err2 == nil {
			cfg := &AgentConfig{}
			if err2 := json.Unmarshal(raw, cfg); err2 == nil {
				_ = s.Save(cfg)          // encrypt to agent.dat
				_ = os.Remove(bootstrapPath) // delete plaintext
				return cfg, nil
			}
		}
	}

	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return &AgentConfig{}, nil
	}
	if err != nil {
		return nil, err
	}
	plain, err := decrypt(data)
	if err != nil {
		return nil, err
	}
	cfg := &AgentConfig{}
	return cfg, json.Unmarshal(plain, cfg)
}

func (s *SecureStore) Wipe() {
	if data, err := os.ReadFile(s.path); err == nil {
		// Overwrite with random bytes before deleting
		_, _ = rand.Read(data)
		_ = os.WriteFile(s.path, data, 0600)
	}
	_ = os.Remove(s.path)
}

// ── encryption helpers ────────────────────────────────────────────────────────

func machineKey() []byte {
	host, _ := os.Hostname()
	seed := host + runtime.GOOS + "ShieldAgentSalt2026"
	sum := sha256.Sum256([]byte(seed))
	return sum[:]
}

func encrypt(plain []byte) ([]byte, error) {
	if runtime.GOOS == "windows" {
		return dpapEncrypt(plain)
	}
	return aesEncrypt(machineKey(), plain)
}

func decrypt(blob []byte) ([]byte, error) {
	if runtime.GOOS == "windows" {
		return dpapDecrypt(blob)
	}
	return aesDecrypt(machineKey(), blob)
}

func aesEncrypt(key, plain []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plain, nil), nil
}

func aesDecrypt(key, blob []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	ns := gcm.NonceSize()
	if len(blob) < ns {
		return nil, errors.New("ciphertext too short")
	}
	return gcm.Open(nil, blob[:ns], blob[ns:], nil)
}
