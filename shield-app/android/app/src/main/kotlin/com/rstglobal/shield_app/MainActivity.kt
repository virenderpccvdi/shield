package com.rstglobal.shield_app

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Process
import android.provider.Settings
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {

    companion object {
        const val VPN_CHANNEL            = "com.rstglobal.shield/vpn"
        const val APP_BLOCK_CHANNEL      = "com.rstglobal.shield/app_block"
        const val VPN_PERMISSION_REQUEST = 1001
    }

    private var pendingDohUrl: String? = null
    private var pendingResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // ── VPN channel ──────────────────────────────────────────────────────
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, VPN_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "prepareVpnPermission" -> {
                        // Only shows the system VPN consent dialog — does NOT start the VPN service.
                        // Use this during setup to pre-grant permission so the child screen can
                        // start the VPN silently on every subsequent launch.
                        val intent = VpnService.prepare(this)
                        if (intent != null) {
                            pendingDohUrl = ""          // no service to start after dialog
                            pendingResult = result
                            startActivityForResult(intent, VPN_PERMISSION_REQUEST)
                        } else {
                            result.success(true)        // already granted
                        }
                    }
                    "startVpn" -> {
                        val dohUrl = call.argument<String>("dohUrl")
                        if (dohUrl.isNullOrBlank()) {
                            result.error("INVALID_ARG", "dohUrl is required", null)
                            return@setMethodCallHandler
                        }
                        startVpnWithPermission(dohUrl, result)
                    }
                    "stopVpn" -> {
                        startService(Intent(this, ShieldVpnService::class.java)
                            .setAction(ShieldVpnService.ACTION_STOP))
                        result.success(false)
                    }
                    "isVpnRunning" -> result.success(ShieldVpnService.isRunning)
                    else -> result.notImplemented()
                }
            }

        // ── App-blocking channel ─────────────────────────────────────────────
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, APP_BLOCK_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "setBlockedApps" -> {
                        @Suppress("UNCHECKED_CAST")
                        val packages = call.argument<List<String>>("packages") ?: emptyList()
                        AppBlockerService.setBlockedApps(this, packages)
                        result.success(true)
                    }
                    "setEnabled" -> {
                        val enabled = call.argument<Boolean>("enabled") ?: false
                        AppBlockerService.setEnabled(this, enabled)
                        if (enabled) {
                            startService(Intent(this, AppBlockerService::class.java)
                                .setAction(AppBlockerService.ACTION_START))
                        } else {
                            startService(Intent(this, AppBlockerService::class.java)
                                .setAction(AppBlockerService.ACTION_STOP))
                        }
                        result.success(true)
                    }
                    "setChildName" -> {
                        // Stored for future notification personalisation
                        getSharedPreferences(AppBlockerService.PREFS_NAME, Context.MODE_PRIVATE)
                            .edit().putString("child_name", call.argument<String>("name") ?: "").apply()
                        result.success(true)
                    }
                    "isUsageStatsGranted" -> result.success(hasUsageStatsPermission())
                    "openUsageStatsSettings" -> {
                        startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        })
                        result.success(true)
                    }
                    "isBlockingActive" -> result.success(AppBlockerService.isRunning &&
                            AppBlockerService.isEnabled(this))
                    else -> result.notImplemented()
                }
            }
    }

    private fun hasUsageStatsPermission(): Boolean {
        val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(), packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun startVpnWithPermission(dohUrl: String, result: MethodChannel.Result) {
        val intent = VpnService.prepare(this)
        if (intent != null) {
            pendingDohUrl = dohUrl
            pendingResult = result
            startActivityForResult(intent, VPN_PERMISSION_REQUEST)
        } else {
            launchVpnService(dohUrl)
            result.success(true)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == VPN_PERMISSION_REQUEST) {
            val dohUrl = pendingDohUrl
            val result = pendingResult
            pendingDohUrl = null
            pendingResult = null
            if (resultCode == RESULT_OK) {
                // Only launch the VPN service if we have a real dohUrl
                // (prepareVpnPermission sets dohUrl to "" and skips service start)
                if (!dohUrl.isNullOrBlank()) {
                    launchVpnService(dohUrl)
                }
                result?.success(true)
            } else {
                result?.success(false)
            }
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    private fun launchVpnService(dohUrl: String) {
        startService(
            Intent(this, ShieldVpnService::class.java)
                .setAction(ShieldVpnService.ACTION_START)
                .putExtra(ShieldVpnService.EXTRA_DOH_URL, dohUrl)
        )
    }
}
