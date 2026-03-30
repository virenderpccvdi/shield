// Package api provides the Shield backend HTTP client.
package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/rstglobal/shield-agent/internal/config"
	"github.com/rstglobal/shield-agent/internal/store"
)

type Client struct {
	http  *http.Client
	store *store.SecureStore
	cfg   *store.AgentConfig
}

func New(s *store.SecureStore) *Client {
	cfg, _ := s.Load()
	return &Client{
		http:  &http.Client{Timeout: 10 * time.Second},
		store: s,
		cfg:   cfg,
	}
}

func (c *Client) IsPaired() bool {
	return c.cfg.ProfileID != "" && c.cfg.DNSClientID != ""
}

func (c *Client) ProfileID() string   { return c.cfg.ProfileID }
func (c *Client) DNSClientID() string { return c.cfg.DNSClientID }
func (c *Client) DeviceID() string    { return c.cfg.DeviceID }
func (c *Client) ChildName() string {
	if c.cfg.ChildName == "" {
		return "Child"
	}
	return c.cfg.ChildName
}

// Reload refreshes in-memory config from disk.
func (c *Client) Reload() {
	cfg, _ := c.store.Load()
	if cfg != nil {
		c.cfg = cfg
	}
}

// ── Authentication ────────────────────────────────────────────────────────────

func (c *Client) Login(email, password string) error {
	body := map[string]string{"email": email, "password": password}
	status, resp, err := c.request("POST", "/api/v1/auth/login", body, "")
	if err != nil {
		return err
	}
	if status != 200 {
		return fmt.Errorf("login failed: HTTP %d", status)
	}
	data := nested(resp, "data")
	token, _ := data["accessToken"].(string)
	if token == "" {
		token, _ = data["access_token"].(string)
	}
	if token == "" {
		return fmt.Errorf("no access token in response")
	}
	c.cfg.AccessToken = token
	c.cfg.TokenExp = time.Now().Add(23 * time.Hour).Unix()
	c.cfg.Email = email
	return c.store.Save(c.cfg)
}

func (c *Client) ensureToken() error {
	if c.cfg.AccessToken != "" && time.Now().Unix() < c.cfg.TokenExp {
		return nil
	}
	if c.cfg.Email == "" {
		return fmt.Errorf("no stored credentials")
	}
	return c.Login(c.cfg.Email, "")
}

// ── Device pairing ────────────────────────────────────────────────────────────

type PairResult struct {
	DeviceID    string
	ProfileID   string
	DNSClientID string
	ChildName   string
	DoHURL      string
	FilterLevel string
}

func (c *Client) PairDevice(pairingCode, deviceName string) (*PairResult, error) {
	if err := c.ensureToken(); err != nil {
		return nil, err
	}
	body := map[string]string{
		"pairingCode":  pairingCode,
		"deviceName":   deviceName,
		"platform":     config.AgentPlatform,
		"agentVersion": config.AppVersion,
	}
	status, resp, err := c.request("POST", "/api/v1/profiles/devices/pair", body, c.cfg.AccessToken)
	if err != nil {
		return nil, err
	}
	if status != 200 && status != 201 {
		return nil, fmt.Errorf("pairing failed: HTTP %d", status)
	}
	data := nested(resp, "data")
	r := &PairResult{
		DeviceID:    str(data, "deviceId"),
		ProfileID:   str(data, "profileId"),
		DNSClientID: str(data, "dnsClientId"),
		ChildName:   str(data, "name"),
		DoHURL:      str(data, "dohUrl"),
		FilterLevel: str(data, "filterLevel"),
	}
	c.cfg.ProfileID = r.ProfileID
	c.cfg.DNSClientID = r.DNSClientID
	c.cfg.DeviceID = r.DeviceID
	c.cfg.ChildName = r.ChildName
	_ = c.store.Save(c.cfg)
	return r, nil
}

// ── Policy ────────────────────────────────────────────────────────────────────

func (c *Client) GetDNSStatus(profileID string) (paused bool, filterLevel string) {
	if c.ensureToken() != nil {
		return false, "MODERATE"
	}
	_, resp, err := c.request("GET", "/api/v1/dns/"+profileID+"/status", nil, c.cfg.AccessToken)
	if err != nil {
		return false, "MODERATE"
	}
	data := nested(resp, "data")
	paused, _ = data["paused"].(bool)
	filterLevel, _ = data["filterLevel"].(string)
	if filterLevel == "" {
		filterLevel = "MODERATE"
	}
	return
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────

func (c *Client) SendHeartbeat(profileID, deviceID string, metrics map[string]interface{}) {
	if c.ensureToken() != nil {
		return
	}
	payload := map[string]interface{}{
		"profileId":    profileID,
		"deviceId":     deviceID,
		"platform":     config.AgentPlatform,
		"agentVersion": config.AppVersion,
	}
	for k, v := range metrics {
		payload[k] = v
	}
	status, _, err := c.request("POST",
		"/api/v1/profiles/devices/"+deviceID+"/heartbeat",
		payload, c.cfg.AccessToken)
	if err != nil || (status >= 400) {
		log.Printf("[heartbeat] failed: status=%d err=%v", status, err)
	}
}

// ── DNS query batch report ────────────────────────────────────────────────────

func (c *Client) ReportQueries(profileID string, queries []map[string]string) {
	if len(queries) == 0 || c.ensureToken() != nil {
		return
	}
	payload := map[string]interface{}{"profileId": profileID, "queries": queries}
	status, _, err := c.request("POST", "/api/v1/dns/internal/batch-log", payload, c.cfg.AccessToken)
	if err != nil || status >= 400 {
		log.Printf("[report] DNS queries failed: status=%d err=%v", status, err)
	}
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

func (c *Client) request(method, path string, body interface{}, token string) (int, map[string]interface{}, error) {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, nil, err
		}
		bodyReader = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, config.GatewayURL+path, bodyReader)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "ShieldWindowsAgent/"+config.AppVersion)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&result)
	return resp.StatusCode, result, nil
}

func nested(m map[string]interface{}, key string) map[string]interface{} {
	if v, ok := m[key]; ok {
		if n, ok := v.(map[string]interface{}); ok {
			return n
		}
	}
	return map[string]interface{}{}
}

func str(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
