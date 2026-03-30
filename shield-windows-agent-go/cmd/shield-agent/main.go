// Shield Agent — Windows client for Shield Parental Control
//
// Double-click to launch the setup wizard.
// Or use CLI commands:
//   shield-agent install     Install as Windows service (run as Administrator)
//   shield-agent uninstall   Remove the service
//   shield-agent start       Start the service
//   shield-agent stop        Stop the service
//   shield-agent status      Show pairing and service status
//   shield-agent pair CODE   Pair with a child profile (6-digit code)
//   shield-agent run         Run in foreground / debug mode
//   shield-agent svc         Entry point used by Windows SCM (internal)
package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/rstglobal/shield-agent/internal/api"
	"github.com/rstglobal/shield-agent/internal/config"
	"github.com/rstglobal/shield-agent/internal/store"
)

func main() {
	setupLogging()

	args := os.Args[1:]

	// No arguments → interactive setup wizard
	if len(args) == 0 {
		runWizard()
		return
	}

	cmd := strings.ToLower(args[0])

	switch cmd {
	case "svc":
		runWindowsService(false)

	case "run":
		runWindowsService(true)

	case "install":
		mustAdmin()
		if err := installService(); err != nil {
			fatal("install", err)
		}

	case "uninstall":
		mustAdmin()
		if err := uninstallService(); err != nil {
			fatal("uninstall", err)
		}

	case "start":
		mustAdmin()
		if err := startService(); err != nil {
			fatal("start", err)
		}

	case "stop":
		mustAdmin()
		if err := stopService(); err != nil {
			fatal("stop", err)
		}

	case "pair":
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "Usage: shield-agent pair <6-DIGIT-CODE>")
			os.Exit(1)
		}
		doPair(args[1], bufio.NewReader(os.Stdin))

	case "status":
		doStatus()

	case "version":
		fmt.Printf("%s v%s (%s/%s)\n", config.AppName, config.AppVersion, runtime.GOOS, runtime.GOARCH)

	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", cmd)
		printUsage()
		os.Exit(1)
	}
}

// ── Interactive setup wizard ──────────────────────────────────────────────────

func runWizard() {
	reader := bufio.NewReader(os.Stdin)

	printBanner()

	s := store.New(config.ConfigFile)
	client := api.New(s)

	if client.IsPaired() {
		fmt.Printf("  This PC is already paired with child profile: %s\n\n", client.ChildName())
		fmt.Printf("  Service status: %s\n\n", serviceStatus())
		fmt.Println("  Options:")
		fmt.Println("  [1] Show status")
		fmt.Println("  [2] Re-pair with a new code")
		fmt.Println("  [3] Exit")
		fmt.Print("\n  Your choice: ")
		choice := strings.TrimSpace(readLine(reader))
		switch choice {
		case "1":
			doStatus()
		case "2":
			wizardPair(reader, client)
		default:
			fmt.Println("\n  Goodbye.")
		}
		pause()
		return
	}

	fmt.Println("  Welcome! This wizard will set up Shield on this PC.")
	fmt.Println()
	fmt.Println("  You will need:")
	fmt.Println("  • Your Shield parent account email and password")
	fmt.Println("  • A 6-digit pairing code from the Shield dashboard")
	fmt.Println("    (Dashboard → Devices → Windows PC → Generate Pairing Code)")
	fmt.Println()

	wizardPair(reader, client)
	pause()
}

func wizardPair(reader *bufio.Reader, client *api.Client) {
	fmt.Println("─────────────────────────────────────────")
	fmt.Println("  Step 1 of 3 — Parent Account Login")
	fmt.Println("─────────────────────────────────────────")
	fmt.Print("  Email:    ")
	email := strings.TrimSpace(readLine(reader))
	fmt.Print("  Password: ")
	password := readPassword(reader)
	fmt.Println()

	fmt.Println("  Logging in...")
	if err := client.Login(email, password); err != nil {
		fmt.Printf("\n  ✗ Login failed: %v\n", err)
		fmt.Println("  Please check your email and password and try again.")
		pause()
		os.Exit(1)
	}
	fmt.Println("  ✓ Login successful!")
	fmt.Println()

	fmt.Println("─────────────────────────────────────────")
	fmt.Println("  Step 2 of 3 — Enter Pairing Code")
	fmt.Println("─────────────────────────────────────────")
	fmt.Println("  Open the Shield dashboard, go to Devices → Windows PC")
	fmt.Println("  and click \"Generate Pairing Code\".")
	fmt.Println()
	var code string
	for {
		fmt.Print("  Pairing code (6 digits): ")
		code = strings.TrimSpace(readLine(reader))
		if len(code) == 6 && isAllDigits(code) {
			break
		}
		fmt.Println("  ✗ Code must be exactly 6 digits. Try again.")
	}

	deviceName := hostname()
	fmt.Printf("\n  Pairing this PC (%s) with code %s...\n", deviceName, code)
	result, err := client.PairDevice(code, deviceName)
	if err != nil {
		fmt.Printf("\n  ✗ Pairing failed: %v\n", err)
		fmt.Println("  Make sure the code is correct and hasn't expired (15 min TTL).")
		pause()
		os.Exit(1)
	}
	fmt.Printf("  ✓ Paired with child profile: %s\n", result.ChildName)
	fmt.Printf("  ✓ DNS filter level: %s\n", result.FilterLevel)
	fmt.Println()

	fmt.Println("─────────────────────────────────────────")
	fmt.Println("  Step 3 of 3 — Install Windows Service")
	fmt.Println("─────────────────────────────────────────")
	fmt.Println("  Installing Shield Agent as a Windows service so it")
	fmt.Println("  starts automatically every time this PC turns on.")
	fmt.Println()

	if err := installService(); err != nil {
		if strings.Contains(err.Error(), "already exists") {
			fmt.Println("  ℹ Service already installed, updating...")
			_ = uninstallService()
			time.Sleep(time.Second)
			if err2 := installService(); err2 != nil {
				fmt.Printf("  ✗ Service install failed: %v\n", err2)
				fmt.Println("  Run as Administrator and try again.")
				pause()
				os.Exit(1)
			}
		} else {
			fmt.Printf("  ✗ Service install failed: %v\n", err)
			fmt.Println()
			fmt.Println("  ► To fix: right-click ShieldAgent.exe → \"Run as Administrator\"")
			fmt.Println("    then run the wizard again, or use: shield-agent install")
			pause()
			os.Exit(1)
		}
	}

	if err := startService(); err != nil {
		fmt.Printf("  ✗ Could not start service: %v\n", err)
	} else {
		fmt.Println("  ✓ Shield Agent service started!")
	}

	fmt.Println()
	fmt.Println("═════════════════════════════════════════")
	fmt.Printf("  Shield is now protecting %s's PC!\n", result.ChildName)
	fmt.Println("  DNS filtering is active and tamper-resistant.")
	fmt.Println("  You can close this window.")
	fmt.Println("═════════════════════════════════════════")
}

// ── Status ────────────────────────────────────────────────────────────────────

func doStatus() {
	s := store.New(config.ConfigFile)
	client := api.New(s)

	fmt.Printf("%s v%s\n", config.AppName, config.AppVersion)
	fmt.Printf("Platform   : %s/%s\n", runtime.GOOS, runtime.GOARCH)
	fmt.Printf("Config     : %s\n", config.ConfigFile)
	fmt.Println()

	if !client.IsPaired() {
		fmt.Println("Status     : NOT PAIRED")
		fmt.Println("  Run ShieldAgent.exe to start the setup wizard.")
		return
	}

	fmt.Println("Status     : PAIRED")
	fmt.Printf("Child      : %s\n", client.ChildName())
	fmt.Printf("Profile ID : %s\n", client.ProfileID())
	fmt.Printf("Device ID  : %s\n", client.DeviceID())
	fmt.Printf("DNS ID     : %s\n", client.DNSClientID())
	fmt.Printf("Service    : %s\n", serviceStatus())
}

// ── Pair (CLI) ────────────────────────────────────────────────────────────────

func doPair(code string, reader *bufio.Reader) {
	code = strings.TrimSpace(code)
	if len(code) != 6 || !isAllDigits(code) {
		fmt.Fprintln(os.Stderr, "Error: pairing code must be exactly 6 digits.")
		os.Exit(1)
	}

	s := store.New(config.ConfigFile)
	client := api.New(s)

	fmt.Print("Parent email: ")
	email := strings.TrimSpace(readLine(reader))
	fmt.Print("Parent password: ")
	password := readPassword(reader)
	fmt.Println()

	fmt.Printf("Logging in as %s ...\n", email)
	if err := client.Login(email, password); err != nil {
		fmt.Fprintf(os.Stderr, "Login failed: %v\n", err)
		os.Exit(1)
	}

	deviceName := hostname()
	fmt.Printf("Pairing device %q with code %s ...\n", deviceName, code)
	result, err := client.PairDevice(code, deviceName)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Pairing failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\n  ✓ Paired with: %s\n", result.ChildName)
	fmt.Printf("  DNS client ID : %s\n", result.DNSClientID)
	fmt.Printf("  Filter level  : %s\n", result.FilterLevel)
	fmt.Println("\nRun 'shield-agent install' as Administrator to register as a Windows service.")
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func printBanner() {
	fmt.Println()
	fmt.Println("  ╔═══════════════════════════════════════╗")
	fmt.Println("  ║       Shield Parental Control         ║")
	fmt.Println("  ║         Windows Agent v1.0.0          ║")
	fmt.Println("  ║      https://shield.rstglobal.in      ║")
	fmt.Println("  ╚═══════════════════════════════════════╝")
	fmt.Println()
}

func printUsage() {
	fmt.Printf(`%s v%s

Commands:
  (no args)      Launch interactive setup wizard (recommended)
  pair <CODE>    Pair with a child profile using a 6-digit code
  status         Show pairing and service status
  install        Install as Windows service (requires admin)
  uninstall      Remove the Windows service (requires admin)
  start          Start the service (requires admin)
  stop           Stop the service (requires admin)
  run            Run in foreground / debug mode
  version        Print version
`, config.AppName, config.AppVersion)
}

func setupLogging() {
	if len(os.Args) > 1 && strings.ToLower(os.Args[1]) == "svc" {
		if err := os.MkdirAll(filepath.Dir(config.LogFile), 0755); err == nil {
			f, err := os.OpenFile(config.LogFile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
			if err == nil {
				log.SetOutput(f)
			}
		}
	}
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
}

func readLine(r *bufio.Reader) string {
	line, _ := r.ReadString('\n')
	return strings.TrimRight(line, "\r\n")
}

func readPassword(r *bufio.Reader) string {
	// Simple read — Windows console doesn't echo without a terminal library
	return readLine(r)
}

func isAllDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

func pause() {
	fmt.Println("\n  Press Enter to exit...")
	bufio.NewReader(os.Stdin).ReadString('\n')
}

func hostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "WindowsPC-" + fmt.Sprintf("%d", time.Now().Unix()%10000)
	}
	return h
}

func fatal(cmd string, err error) {
	fmt.Fprintf(os.Stderr, "[%s] Error: %v\n", cmd, err)
	os.Exit(1)
}
