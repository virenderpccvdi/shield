package com.rstglobal.shield_app

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Full-screen activity displayed when a blocked app is detected.
 * Replaces the SYSTEM_ALERT_WINDOW overlay approach — no special permission needed.
 */
class BlockedAppActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen on and show above lock screen
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#FF1A1A2E"))
            setPadding(64, 64, 64, 64)
        }

        val shieldIcon = TextView(this).apply {
            text = "\uD83D\uDEE1\uFE0F"   // 🛡️
            textSize = 72f
            gravity = Gravity.CENTER
        }

        val title = TextView(this).apply {
            text = "App Blocked"
            textSize = 26f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setTypeface(null, Typeface.BOLD)
            setPadding(0, 32, 0, 12)
        }

        val subtitle = TextView(this).apply {
            text = "This app has been blocked by\nyour parent or guardian."
            textSize = 16f
            setTextColor(Color.parseColor("#FFAAAAAA"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 48)
        }

        val homeBtn = Button(this).apply {
            text = "Go to Home Screen"
            setOnClickListener { goHome() }
        }

        root.addView(shieldIcon)
        root.addView(title)
        root.addView(subtitle)
        root.addView(homeBtn)
        setContentView(root)
    }

    override fun onBackPressed() = goHome()

    override fun onResume() {
        super.onResume()
        // Check if we should still be showing — if app is no longer in foreground, dismiss
        val pkg = intent?.getStringExtra("blocked_package") ?: return
        val prefs = getSharedPreferences(AppBlockerService.PREFS_NAME, MODE_PRIVATE)
        val blocked = prefs.getStringSet(AppBlockerService.KEY_BLOCKED_PKGS, emptySet()) ?: emptySet()
        if (!blocked.contains(pkg)) finish()
    }

    private fun goHome() {
        startActivity(
            Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        )
        finish()
    }
}
