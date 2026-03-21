# Firebase Setup Guide for Shield App

## Current Status

| Item | Status |
|---|---|
| FCM code (`lib/core/fcm_service.dart`) | Implemented |
| Topic subscription (`shield-child-devices`) | Implemented |
| `google-services.json` | **PLACEHOLDER — replace with real file** |
| Package name in `google-services.json` | `com.rstglobal.shield_app` (needs to match) |
| Notification types handled | SOS, LOCATION_UPDATE, APP_UPDATE, GEOFENCE_BREACH |

## Steps to Enable FCM Push Notifications

### 1. Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click **Add project** → name it "Shield" (or "Shield RST")
3. Disable Google Analytics if not needed → **Create project**

### 2. Add Android App

1. In the Firebase project → **Project Overview** → click the Android icon
2. Fill in:
   - **Android package name**: `com.rstglobal.shield_app`
     (verify in `shield-app/android/app/build.gradle` → `applicationId`)
   - **App nickname**: Shield
   - **Debug signing certificate SHA-1**: optional for FCM
3. Click **Register app**

### 3. Download google-services.json

1. Click **Download google-services.json**
2. Replace the placeholder file at:
   ```
   /var/www/ai/FamilyShield/shield-app/android/app/google-services.json
   ```
   with the downloaded file.

### 4. Get FCM Server Key (for backend push sending)

1. In Firebase Console → **Project Settings** → **Cloud Messaging** tab
2. Under **Cloud Messaging API (Legacy)** → copy the **Server key**
   (or use the newer **FCM v1 API** with service account credentials)
3. Add to `/var/www/ai/FamilyShield/.env`:
   ```
   FCM_SERVER_KEY=AAAA...your_server_key_here
   ```
4. Restart the notification service:
   ```bash
   systemctl restart shield-notification
   ```

### 5. Enable FCM in notification service

In `/var/www/ai/FamilyShield/shield-notification/src/main/resources/application.properties`
(or via `.env`), set:
```
FIREBASE_ENABLED=true
```

### 6. Rebuild APK

After replacing `google-services.json`:
```bash
cd /var/www/ai/FamilyShield/shield-app
flutter build apk --debug --no-tree-shake-icons
cp build/app/outputs/flutter-apk/app-debug.apk /var/www/ai/FamilyShield/static/shield-app.apk
```

## Placeholder File Warning

The current `shield-app/android/app/google-services.json` is a **placeholder** with dummy values:
- `project_id`: `shield-placeholder`
- `mobilesdk_app_id`: `1:000000000000:android:0000000000000000`
- Package name: `com.rstglobal.shield_app` ← this matches the real `applicationId`

The app will build successfully but FCM push notifications will not work until the real file is in place.

## Notification Types

The app handles these FCM notification types in `lib/core/fcm_service.dart`:

| Type | Action |
|---|---|
| `SOS` | Show high-priority SOS alert, navigate to panic screen |
| `LOCATION_UPDATE` | Refresh location data in background |
| `APP_UPDATE` | Prompt user to update the app |
| `GEOFENCE_BREACH` | Show geofence entry/exit notification |

## Testing FCM (after setup)

From the Firebase Console → **Messaging** → **Send your first message**:
1. Compose a notification
2. Target: **Single device** → paste the device FCM token from app logs
3. Send test message

Or via curl with the server key:
```bash
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=YOUR_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "DEVICE_FCM_TOKEN",
    "notification": {"title": "Test", "body": "Shield FCM working!"},
    "data": {"type": "SOS"}
  }'
```
