package com.rstglobal.shield_app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.InetSocketAddress
import java.net.URL
import java.nio.ByteBuffer

/**
 * Shield DNS VPN Service
 *
 * Creates a local TUN interface that intercepts all DNS queries (UDP port 53)
 * and forwards them to the Shield DoH server. This ensures every device that
 * has the Shield child app installed automatically routes DNS through our filters —
 * no manual Private DNS setup required.
 *
 * Architecture:
 *  Device → TUN(10.111.0.1) → ShieldVpnService → HTTPS POST /dns/{clientId}/dns-query
 *                                                 → TUN response → Device
 */
class ShieldVpnService : VpnService() {

    companion object {
        const val TAG = "ShieldVpnService"
        const val ACTION_START = "com.rstglobal.shield_app.VPN_START"
        const val ACTION_STOP  = "com.rstglobal.shield_app.VPN_STOP"
        const val EXTRA_DOH_URL   = "doh_url"
        const val EXTRA_CLIENT_ID = "client_id"
        const val CHANNEL_ID = "shield_vpn_channel"
        const val NOTIF_ID = 1001

        @Volatile var isRunning = false
    }

    private var vpnInterface: ParcelFileDescriptor? = null
    private var dohUrl: String = ""
    @Volatile private var running = false

    /**
     * IP address of the DoH server, resolved BEFORE the VPN tunnel is started.
     * Used instead of hostname in socket connections to avoid the DNS resolution loop:
     * if we used the hostname, the OS would try to resolve it via the VPN's fake DNS
     * (10.111.0.2), which calls back into forwardToDoh(), causing infinite recursion.
     */
    private var dohServerIp: String? = null

    // ── Lifecycle ────────────────────────────────────────────────────────────

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP  -> { stopVpn(); return START_NOT_STICKY }
            ACTION_START -> {
                dohUrl = intent.getStringExtra(EXTRA_DOH_URL) ?: run {
                    Log.e(TAG, "No DoH URL provided — cannot start VPN")
                    return START_NOT_STICKY
                }
                startForeground(NOTIF_ID, buildNotification())
                startVpn()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }

    override fun onRevoke() {
        stopVpn()
        super.onRevoke()
    }

    // ── VPN setup ────────────────────────────────────────────────────────────

    private fun startVpn() {
        if (running) return
        try {
            // ── Pre-resolve DoH server IP BEFORE establishing the VPN tunnel ──────────
            // CRITICAL: must happen here, before builder.establish(), while the device
            // still uses its normal DNS. After the tunnel is up, all DNS goes through our
            // fake 10.111.0.2 server, so resolving the hostname there would recursively
            // call forwardToDoh() → deadlock. We cache the IP and use it directly in
            // openProtectedConnection() instead of the hostname.
            try {
                val dohHost = java.net.URL(dohUrl).host
                dohServerIp = java.net.InetAddress.getByName(dohHost).hostAddress
                Log.i(TAG, "Pre-resolved DoH host $dohHost → $dohServerIp")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to pre-resolve DoH host — VPN will not start: ${e.message}")
                return
            }

            // Fake DNS address — all DNS queries will appear to go here; we intercept them
            val fakeDns = "10.111.0.2"

            // Known DoH provider IPs — route through VPN so their port-443 HTTPS connections
            // are silently dropped, forcing browsers (Chrome, Firefox) to fall back to
            // UDP port 53 which we DO intercept and forward to Shield.
            // Google: 8.8.8.8, 8.8.4.4  |  Cloudflare: 1.1.1.1, 1.0.0.1
            // Quad9: 9.9.9.9             |  OpenDNS: 208.67.222.222, 208.67.220.220
            val dohBlockIps = listOf(
                "8.8.8.8", "8.8.4.4",
                "1.1.1.1", "1.0.0.1",
                "9.9.9.9", "149.112.112.112",
                "208.67.222.222", "208.67.220.220"
            )

            val builder = Builder()
                .setSession("Shield Parental Control")
                .addAddress("10.111.0.1", 30)
                .addDnsServer(fakeDns)
                .addRoute(fakeDns, 32)
                .setBlocking(true)
                .setMtu(1500)

            // Route all known DoH provider IPs through the VPN tunnel
            dohBlockIps.forEach { ip -> builder.addRoute(ip, 32) }

            vpnInterface = builder.establish()
            if (vpnInterface == null) {
                Log.e(TAG, "Failed to establish VPN interface")
                return
            }

            running = true
            isRunning = true
            Log.i(TAG, "Shield VPN started → DoH: $dohUrl")

            Thread({ runDnsProxy() }, "shield-dns-proxy").start()

        } catch (e: Exception) {
            Log.e(TAG, "VPN start error: ${e.message}")
            isRunning = false
        }
    }

    private fun stopVpn() {
        running = false
        isRunning = false
        try { vpnInterface?.close() } catch (_: Exception) {}
        vpnInterface = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        Log.i(TAG, "Shield VPN stopped")
    }

    // ── DNS proxy loop ────────────────────────────────────────────────────────

    private fun runDnsProxy() {
        val fd = vpnInterface?.fileDescriptor ?: return
        val input  = FileInputStream(fd)
        val output = FileOutputStream(fd)
        val packet = ByteArray(32767)

        while (running) {
            try {
                val len = input.read(packet)
                if (len < 20) continue                     // too small for IPv4 header

                val b = ByteBuffer.wrap(packet, 0, len)

                // ── IPv4 check ──
                val version = (b.get(0).toInt() and 0xF0) ushr 4
                if (version != 4) continue

                val ihl = (b.get(0).toInt() and 0x0F) * 4
                val proto = b.get(9).toInt() and 0xFF
                if (proto != 17) continue                  // UDP only

                if (len < ihl + 8) continue
                val dstPort = (b.get(ihl + 2).toInt() and 0xFF shl 8) or (b.get(ihl + 3).toInt() and 0xFF)
                if (dstPort != 53) continue                // DNS only

                val udpOff = ihl + 8
                val udpLen = len - udpOff
                if (udpLen <= 0) continue

                val dnsQuery = packet.copyOfRange(udpOff, udpOff + udpLen)
                val querySnap = packet.copyOf(len)         // snapshot for async thread

                Thread({
                    try {
                        val response = forwardToDoh(dnsQuery) ?: return@Thread
                        val resp = buildResponsePacket(querySnap, ihl, response)
                        synchronized(output) { output.write(resp) }
                    } catch (e: Exception) {
                        Log.w(TAG, "DNS forward error: ${e.message}")
                    }
                }).start()

            } catch (e: Exception) {
                if (running) Log.w(TAG, "VPN read error: ${e.message}")
            }
        }

        try { input.close()  } catch (_: Exception) {}
        try { output.close() } catch (_: Exception) {}
    }

    // ── DoH forwarding ───────────────────────────────────────────────────────

    /**
     * Forward a raw DNS wire-format query to the Shield DoH server.
     * Uses a manually protected socket to avoid the DoH request itself being
     * intercepted by the VPN tunnel (which would cause an infinite loop).
     */
    private fun forwardToDoh(dnsQuery: ByteArray): ByteArray? = openProtectedConnection(dohUrl, dnsQuery)

    /**
     * Open an HTTPS connection with a VPN-protected socket so the DoH request
     * doesn't re-enter the tunnel (which would cause infinite DNS resolution loop).
     *
     * KEY: we connect using the pre-resolved IP (dohServerIp), NOT the hostname.
     * InetSocketAddress(hostname, port) would trigger OS DNS resolution, which goes
     * through our fake DNS 10.111.0.2, which calls forwardToDoh() again → infinite loop.
     * Using the cached IP bypasses DNS entirely. The hostname is still passed to
     * createSocket() so TLS SNI and certificate verification work correctly.
     */
    private fun openProtectedConnection(url: String, body: ByteArray): ByteArray? {
        return try {
            val u = URL(url)
            val port = if (u.port == -1) 443 else u.port

            // Use pre-resolved IP — never do hostname resolution inside the VPN tunnel
            val serverIp = dohServerIp ?: run {
                Log.e(TAG, "dohServerIp not set — cannot forward DNS query")
                return null
            }

            val rawSocket = java.net.Socket()
            protect(rawSocket)                             // excludes socket from VPN routing

            // Connect via IP address (no DNS lookup) — hostname is for SNI only
            rawSocket.connect(InetSocketAddress(serverIp, port), 5000)

            val sslFactory = javax.net.ssl.SSLSocketFactory.getDefault() as javax.net.ssl.SSLSocketFactory
            // Pass u.host for SNI so TLS certificate matches the expected hostname
            val sslSocket  = sslFactory.createSocket(rawSocket, u.host, port, true) as javax.net.ssl.SSLSocket
            sslSocket.startHandshake()

            val path = if (u.query != null) "${u.path}?${u.query}" else u.path
            val request = buildString {
                append("POST $path HTTP/1.1\r\n")
                append("Host: ${u.host}\r\n")
                append("Content-Type: application/dns-message\r\n")
                append("Accept: application/dns-message\r\n")
                append("Content-Length: ${body.size}\r\n")
                append("Connection: close\r\n")
                append("\r\n")
            }

            val out = sslSocket.outputStream
            out.write(request.toByteArray(Charsets.US_ASCII))
            out.write(body)
            out.flush()

            val respBytes = sslSocket.inputStream.readBytes()
            sslSocket.close()

            // Parse HTTP response — skip headers, return body
            val sep = findHeaderEnd(respBytes) ?: return null
            val responseBody = respBytes.copyOfRange(sep, respBytes.size)

            // Verify 200 OK from first line
            val statusLine = String(respBytes.copyOfRange(0, minOf(20, sep)), Charsets.US_ASCII)
            if (!statusLine.contains("200")) {
                Log.w(TAG, "DoH non-200: $statusLine")
                return null
            }

            responseBody

        } catch (e: Exception) {
            Log.w(TAG, "Protected DoH connection failed: ${e.message}")
            null
        }
    }

    /** Find end of HTTP headers (\r\n\r\n) — returns index of first byte after headers. */
    private fun findHeaderEnd(data: ByteArray): Int? {
        for (i in 0..data.size - 4) {
            if (data[i] == '\r'.code.toByte() && data[i+1] == '\n'.code.toByte() &&
                data[i+2] == '\r'.code.toByte() && data[i+3] == '\n'.code.toByte()) {
                return i + 4
            }
        }
        return null
    }

    // ── Packet building ───────────────────────────────────────────────────────

    /**
     * Build an IPv4/UDP response packet by swapping src/dst IP addresses and ports
     * from the original query packet, then appending the DNS response payload.
     */
    private fun buildResponsePacket(query: ByteArray, ihl: Int, dnsResponse: ByteArray): ByteArray {
        val totalLen = ihl + 8 + dnsResponse.size
        val resp = ByteArray(totalLen)

        // Copy IP header from query
        System.arraycopy(query, 0, resp, 0, ihl)

        // Swap src IP (bytes 12–15) ↔ dst IP (bytes 16–19)
        System.arraycopy(query, 12, resp, 16, 4)
        System.arraycopy(query, 16, resp, 12, 4)

        // Update total length field
        resp[2] = (totalLen ushr 8).toByte()
        resp[3] = (totalLen and 0xFF).toByte()

        // Clear IP checksum (kernel recalculates)
        resp[10] = 0; resp[11] = 0

        // UDP header: swap src port ↔ dst port
        resp[ihl]     = query[ihl + 2]
        resp[ihl + 1] = query[ihl + 3]
        resp[ihl + 2] = query[ihl]
        resp[ihl + 3] = query[ihl + 1]
        val udpLen = 8 + dnsResponse.size
        resp[ihl + 4] = (udpLen ushr 8).toByte()
        resp[ihl + 5] = (udpLen and 0xFF).toByte()
        resp[ihl + 6] = 0; resp[ihl + 7] = 0  // UDP checksum (0 = disabled for IPv4)

        // DNS response payload
        System.arraycopy(dnsResponse, 0, resp, ihl + 8, dnsResponse.size)

        return resp
    }

    // ── Notification ─────────────────────────────────────────────────────────

    private fun buildNotification(): Notification {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Shield DNS Protection", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Keeps Shield parental DNS filtering active"
                setShowBadge(false)
            }
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Shield DNS Protection Active")
            .setContentText("Parental controls are protecting this device")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .build()
    }
}
