// Package dns implements a local UDP DNS stub resolver.
// It listens on 127.0.0.1:53 and forwards every query as an RFC 8484
// DoH POST to https://shield.rstglobal.in/dns/{clientId}/dns-query.
package dns

import (
	"bytes"
	"crypto/tls"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rstglobal/shield-agent/internal/config"
)

const (
	maxPacket = 512
	dohBase   = config.GatewayURL + "/dns"
)

// Stub is a lightweight DNS-over-HTTPS proxy.
type Stub struct {
	clientID atomic.Value // string
	conn     *net.UDPConn
	stop     chan struct{}
	once     sync.Once
	http     *http.Client
}

func NewStub(clientID string) *Stub {
	s := &Stub{
		stop: make(chan struct{}),
		http: &http.Client{
			Timeout: 5 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12},
			},
		},
	}
	s.clientID.Store(clientID)
	return s
}

func (s *Stub) SetClientID(id string) { s.clientID.Store(id) }
func (s *Stub) ClientID() string      { return s.clientID.Load().(string) }

func (s *Stub) dohURL() string {
	return fmt.Sprintf("%s/%s/dns-query", dohBase, s.ClientID())
}

// Start begins listening. Blocks until Stop() is called.
func (s *Stub) Start() error {
	addr, err := net.ResolveUDPAddr("udp4", config.DNSListenAddr)
	if err != nil {
		return err
	}
	conn, err := net.ListenUDP("udp4", addr)
	if err != nil {
		return fmt.Errorf("DNS stub: cannot bind %s — need admin: %w", config.DNSListenAddr, err)
	}
	s.conn = conn
	log.Printf("[dns] stub listening on %s → %s", config.DNSListenAddr, s.dohURL())

	buf := make([]byte, maxPacket)
	for {
		select {
		case <-s.stop:
			return nil
		default:
		}
		_ = conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
		n, addr, err := conn.ReadFromUDP(buf)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			return err
		}
		query := make([]byte, n)
		copy(query, buf[:n])
		go s.handle(conn, addr, query)
	}
}

func (s *Stub) Stop() {
	s.once.Do(func() {
		close(s.stop)
		if s.conn != nil {
			_ = s.conn.Close()
		}
	})
}

func (s *Stub) handle(conn *net.UDPConn, addr *net.UDPAddr, query []byte) {
	resp, err := s.forward(query)
	if err != nil {
		log.Printf("[dns] forward error: %v", err)
		// Send SERVFAIL
		if len(query) >= 2 {
			fail := make([]byte, 12)
			copy(fail[:2], query[:2])
			binary.BigEndian.PutUint16(fail[2:], 0x8002) // QR=1, RCODE=SERVFAIL
			_, _ = conn.WriteToUDP(fail, addr)
		}
		return
	}
	_, _ = conn.WriteToUDP(resp, addr)
}

func (s *Stub) forward(query []byte) ([]byte, error) {
	req, err := http.NewRequest("POST", s.dohURL(), bytes.NewReader(query))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/dns-message")
	req.Header.Set("Accept", "application/dns-message")
	req.Header.Set("User-Agent", "ShieldAgent/"+config.AppVersion)
	resp, err := s.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(io.LimitReader(resp.Body, 4096))
}

// IsBlocked checks if a DNS response contains a 0.0.0.0 A record (Shield's block response).
func IsBlocked(response []byte) bool {
	if len(response) < 12 {
		return false
	}
	rcode := int(response[3] & 0x0F)
	if rcode == 3 || rcode == 5 {
		return true
	}
	ancount := int(binary.BigEndian.Uint16(response[6:8]))
	if ancount == 0 {
		return rcode == 0
	}
	// Skip question section
	offset := 12
	qdcount := int(binary.BigEndian.Uint16(response[4:6]))
	for i := 0; i < qdcount && offset < len(response); i++ {
		for offset < len(response) {
			l := int(response[offset])
			offset++
			if l == 0 {
				break
			}
			if l&0xC0 == 0xC0 {
				offset++
				break
			}
			offset += l
		}
		offset += 4
	}
	// Check answer records
	for i := 0; i < ancount && offset < len(response); i++ {
		if offset < len(response) && response[offset]&0xC0 == 0xC0 {
			offset += 2
		} else {
			for offset < len(response) && response[offset] != 0 {
				offset += int(response[offset]) + 1
			}
			offset++
		}
		if offset+10 > len(response) {
			break
		}
		rtype := int(binary.BigEndian.Uint16(response[offset:]))
		rdlen := int(binary.BigEndian.Uint16(response[offset+8:]))
		offset += 10
		if rtype == 1 && rdlen == 4 && offset+4 <= len(response) {
			ip := response[offset : offset+4]
			if ip[0] == 0 && ip[1] == 0 && ip[2] == 0 && ip[3] == 0 {
				return true
			}
		}
		offset += rdlen
	}
	return false
}
