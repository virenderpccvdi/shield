# Flutter
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Keep local_auth / biometric
-keep class androidx.biometric.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Dio / OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# Keep app classes
-keep class com.rstglobal.** { *; }
-keep class com.rstglobal.shield_app.** { *; }

# Keep Gson / JSON model serialisation
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# Flutter Play Store deferred components (suppress missing class warnings)
-dontwarn com.google.android.play.core.**
-keep class com.google.android.play.core.** { *; }

# Keep Stripe if used natively
-keep class com.stripe.** { *; }

# Google Maps
-keep class com.google.android.gms.maps.** { *; }
-keep class com.google.maps.android.** { *; }

# mobile_scanner / ZXing
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**

# installed_apps
-keep class com.sharmadhiraj.installedapps.** { *; }

# flutter_local_notifications
-keep class com.dexterous.** { *; }

# Suppress common R8 warnings
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
