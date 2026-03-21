package com.rstglobal.shield_app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.IBinder
import android.util.Log

/**
 * Shield App Blocker Service
 *
 * Polls UsageStatsManager every 800ms to detect the foreground app.
 * When a blocked app is detected, launches BlockedAppActivity (full-screen).
 *
 * Uses PACKAGE_USAGE_STATS (granted by user in Settings > Apps > Special Access > Usage Access).
 * Does NOT require AccessibilityService or SYSTEM_ALERT_WINDOW.
 */
class AppBlockerService : Service() {

    companion object {
        const val TAG = "AppBlockerService"
        const val PREFS_NAME = "shield_app_block"
        const val KEY_ENABLED = "blocking_enabled"
        const val KEY_BLOCKED_PKGS = "blocked_packages"
        const val CHANNEL_ID = "shield_block_channel"
        const val NOTIF_ID = 1002
        const val ACTION_START = "com.rstglobal.shield_app.BLOCK_START"
        const val ACTION_STOP  = "com.rstglobal.shield_app.BLOCK_STOP"
        const val POLL_MS = 800L

        @Volatile var isRunning = false

        fun setBlockedApps(context: Context, packages: List<String>) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putStringSet(KEY_BLOCKED_PKGS, packages.toSet()).apply()
        }

        fun setEnabled(context: Context, enabled: Boolean) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_ENABLED, enabled).apply()
        }

        fun isEnabled(context: Context): Boolean =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean(KEY_ENABLED, false)
    }

    private lateinit var prefs: SharedPreferences
    private lateinit var usageStats: UsageStatsManager
    @Volatile private var running = false
    private var lastBlockedPkg = ""
    private var lastBlockTime = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        usageStats = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (!running) {
            startForeground(NOTIF_ID, buildNotification())
            running = true
            isRunning = true
            Thread({ pollLoop() }, "shield-app-blocker").start()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        isRunning = false
        super.onDestroy()
    }

    private fun pollLoop() {
        while (running) {
            try {
                if (prefs.getBoolean(KEY_ENABLED, false)) {
                    val fg = getForegroundApp()
                    if (fg != null && fg != packageName) {
                        val blocked = prefs.getStringSet(KEY_BLOCKED_PKGS, emptySet()) ?: emptySet()
                        // Throttle: don't re-launch block screen for same app within 2s
                        val now = System.currentTimeMillis()
                        if (blocked.contains(fg) && !(fg == lastBlockedPkg && now - lastBlockTime < 2000)) {
                            lastBlockedPkg = fg
                            lastBlockTime = now
                            launchBlockScreen(fg)
                        }
                    }
                }
                Thread.sleep(POLL_MS)
            } catch (e: InterruptedException) {
                break
            } catch (e: Exception) {
                Log.w(TAG, "Poll error: ${e.message}")
            }
        }
    }

    private fun getForegroundApp(): String? {
        val now = System.currentTimeMillis()
        return try {
            val stats = usageStats.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY, now - 5000, now
            )
            stats?.maxByOrNull { it.lastTimeUsed }?.packageName
        } catch (e: Exception) {
            null
        }
    }

    private fun launchBlockScreen(pkg: String) {
        startActivity(
            Intent(this, BlockedAppActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("blocked_package", pkg)
            }
        )
    }

    private fun buildNotification(): Notification {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Shield App Controls", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Monitors app usage for parental controls"
                setShowBadge(false)
            }
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Shield Parental Controls Active")
            .setContentText("App usage monitoring is active")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .build()
    }
}
