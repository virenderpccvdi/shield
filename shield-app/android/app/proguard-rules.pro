# Flutter
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Keep local_auth
-keep class androidx.biometric.** { *; }

# Keep Firebase
-keep class com.google.firebase.** { *; }

# Keep Stripe if used natively
-keep class com.stripe.** { *; }

# Keep app classes
-keep class com.rstglobal.shield_app.** { *; }

# Flutter Play Store deferred components (suppress missing class warnings)
-dontwarn com.google.android.play.core.**
-keep class com.google.android.play.core.** { *; }
