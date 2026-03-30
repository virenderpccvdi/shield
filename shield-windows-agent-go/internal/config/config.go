package config

const (
	AppName        = "Shield Agent"
	AppVersion     = "1.0.0"
	AgentPlatform  = "windows"

	GatewayURL  = "https://shield.rstglobal.in"
	DNSDomain   = "dns.shield.rstglobal.in"

	ServiceName    = "ShieldAgent"
	ServiceDisplay = "Shield Parental Control Agent"
	ServiceDesc    = "Shield DNS filtering, monitoring and reporting for child devices."

	ConfigDir  = `C:\ProgramData\RSTGlobal\ShieldAgent`
	ConfigFile = `C:\ProgramData\RSTGlobal\ShieldAgent\agent.dat`
	LogFile    = `C:\ProgramData\RSTGlobal\ShieldAgent\agent.log`

	HeartbeatInterval  = 60  // seconds
	ReportInterval     = 300
	PolicySyncInterval = 120
	WatchdogInterval   = 30

	DNSListenAddr = "127.0.0.1:53"
)
