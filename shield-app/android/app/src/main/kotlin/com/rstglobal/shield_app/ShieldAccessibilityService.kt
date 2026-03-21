package com.rstglobal.shield_app

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray

/**
 * Shield App Blocking Service
 *
 * Monitors foreground app changes via AccessibilityService.
 * When a blocked app comes to foreground, shows a full-screen overlay
 * and sends the user back to the home screen.
 *
 * Blocked packages list is stored in SharedPreferences and updated
 * by MainActivity via MethodChannel.
 */
class ShieldAccessibilityService : AccessibilityService() {

    companion object {
        const val PREFS_NAME        = "shield_app_block"
        const val KEY_ENABLED       = "blocking_enabled"
        const val KEY_BLOCKED_PKGS  = "blocked_packages"
        const val KEY_CHILD_NAME    = "child_name"

        @Volatile var isRunning = false

        fun setBlockedApps(context: Context, packages: List<String>) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val arr = JSONArray()
            packages.forEach { arr.put(it) }
            prefs.edit().putString(KEY_BLOCKED_PKGS, arr.toString()).apply()
        }

        fun setEnabled(context: Context, enabled: Boolean) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(KEY_ENABLED, enabled).apply()
        }

        fun setChildName(context: Context, name: String) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_CHILD_NAME, name).apply()
        }

        fun getBlockedApps(context: Context): Set<String> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(KEY_BLOCKED_PKGS, "[]") ?: "[]"
            return try {
                val arr = JSONArray(json)
                (0 until arr.length()).map { arr.getString(it) }.toSet()
            } catch (e: Exception) {
                emptySet()
            }
        }

        fun isEnabled(context: Context): Boolean {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getBoolean(KEY_ENABLED, false)
        }
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var lastBlockedPkg: String? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        isRunning = true
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        removeOverlay()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val pkg = event.packageName?.toString() ?: return

        // Ignore our own app and system UI
        if (pkg == applicationContext.packageName) return
        if (pkg == "com.android.systemui") return
        if (pkg == "com.android.launcher" || pkg.contains("launcher") || pkg.contains("home")) return

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean(KEY_ENABLED, false)
        if (!enabled) return

        val blockedPkgs = getBlockedApps(this)
        if (blockedPkgs.isEmpty()) return

        if (blockedPkgs.contains(pkg)) {
            mainHandler.post {
                showBlockOverlay(pkg)
                goHome()
            }
        } else {
            // App is allowed — remove overlay if showing
            if (overlayView != null) {
                mainHandler.post { removeOverlay() }
            }
        }
    }

    override fun onInterrupt() {}

    private fun showBlockOverlay(packageName: String) {
        removeOverlay()
        lastBlockedPkg = packageName

        val appName = try {
            packageManager.getApplicationLabel(
                packageManager.getApplicationInfo(packageName, 0)
            ).toString()
        } catch (e: Exception) {
            packageName
        }

        // Build overlay layout programmatically (no XML needed)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#CC1a1a2e"))
            setPadding(64, 64, 64, 64)
        }

        val iconView = TextView(this).apply {
            text = "🚫"
            textSize = 64f
            gravity = Gravity.CENTER
        }

        val titleView = TextView(this).apply {
            text = "App Blocked"
            textSize = 28f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 12)
            setTypeface(null, android.graphics.Typeface.BOLD)
        }

        val appNameView = TextView(this).apply {
            text = "\"$appName\" is restricted"
            textSize = 18f
            setTextColor(Color.parseColor("#BBBBCC"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 8)
        }

        val msgView = TextView(this).apply {
            text = "This app has been blocked by your parent.\nPlease contact them if you need access."
            textSize = 15f
            setTextColor(Color.parseColor("#AAAAAA"))
            gravity = Gravity.CENTER
            setPadding(16, 8, 16, 40)
        }

        val homeBtn = Button(this).apply {
            text = "Go Home"
            textSize = 16f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#E53935"))
            setPadding(48, 24, 48, 24)
            setOnClickListener {
                removeOverlay()
                goHome()
            }
        }

        layout.addView(iconView)
        layout.addView(titleView)
        layout.addView(appNameView)
        layout.addView(msgView)
        layout.addView(homeBtn)

        val container = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#CC000000"))
            addView(layout, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
                Gravity.CENTER
            ))
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
        }

        try {
            windowManager?.addView(container, params)
            overlayView = container
        } catch (e: Exception) {
            // Overlay permission not granted
        }
    }

    private fun removeOverlay() {
        overlayView?.let {
            try {
                windowManager?.removeView(it)
            } catch (e: Exception) { /* ignore */ }
            overlayView = null
            lastBlockedPkg = null
        }
    }

    private fun goHome() {
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
    }
}
