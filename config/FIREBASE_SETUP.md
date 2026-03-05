# Firebase Cloud Messaging (FCM) Setup Guide

This guide covers setting up Firebase for the Shield platform to enable push
notifications to Android/iOS devices.

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Project name: `Shield` (or `shield-family-protection`)
4. Disable Google Analytics (optional, not needed for FCM)
5. Click "Create project"

## 2. Add Android App

1. In Firebase Console, click the Android icon to add an app
2. Package name: `com.rstglobal.shield_app`
3. App nickname: `Shield Android`
4. SHA-1 (optional for FCM, needed for Google Sign-In later):
   ```bash
   cd /var/www/ai/FamilyShield/shield-app/android
   ./gradlew signingReport
   ```
5. Click "Register app"
6. Download `google-services.json`
7. Place it at:
   ```
   /var/www/ai/FamilyShield/shield-app/android/app/google-services.json
   ```
   (This replaces the placeholder file already there)

## 3. Generate Service Account Key (Backend)

1. In Firebase Console, go to Project Settings > Service accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Place it at:
   ```
   /var/www/ai/FamilyShield/config/firebase-service-account.json
   ```
5. Set proper permissions:
   ```bash
   chmod 600 /var/www/ai/FamilyShield/config/firebase-service-account.json
   ```

## 4. Enable FCM in Config

Edit `/var/www/ai/FamilyShield/config-repo/shield-notification.yml`:

```yaml
firebase:
  enabled: true  # Change from false to true
  service-account-path: /var/www/ai/FamilyShield/config/firebase-service-account.json
```

Then restart the notification service:

```bash
sudo systemctl restart shield-notification
```

## 5. Verify

Check logs for successful Firebase initialization:

```bash
journalctl -u shield-notification -f --no-pager | grep -i firebase
```

You should see:
```
Firebase Admin SDK initialized from /var/www/ai/FamilyShield/config/firebase-service-account.json
```

## 6. Test Push Notification

Send a test push via the internal API:

```bash
curl -X POST http://localhost:8286/internal/notifications/push \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "USER_UUID_HERE",
    "title": "Test Push",
    "body": "If you see this, FCM is working!",
    "priority": "HIGH"
  }'
```

## 7. Flutter App Build

After replacing `google-services.json` with the real one:

```bash
cd /var/www/ai/FamilyShield/shield-app
flutter build apk --debug --no-tree-shake-icons
```

## Architecture

```
Flutter App                       Backend
-----------                       -------
Firebase.initializeApp()
  |
  v
Get FCM token ----POST /api/v1/notifications/fcm/register----> DeviceToken saved in DB
  |
  v
Listen for messages               Other services call:
  |                               POST /internal/notifications/push
  v                                 |
Show local notification <---FCM----FcmService.sendToUser()
```

## Files Modified

### Backend (shield-notification)
- `pom.xml` - Added firebase-admin 9.4.3
- `config/FirebaseConfig.java` - Conditional Firebase initialization
- `service/FcmService.java` - Send push via FCM, handle errors/token expiry
- `controller/FcmTokenController.java` - Token register/unregister endpoints
- `controller/InternalNotifyController.java` - Added POST /internal/notifications/push
- `service/NotificationDispatcher.java` - FCM added to dispatch chain
- `dto/request/FcmTokenRequest.java` - Token registration DTO
- `dto/request/PushNotificationRequest.java` - Push request DTO

### Flutter (shield-app)
- `pubspec.yaml` - Added firebase_core, firebase_messaging
- `android/settings.gradle` - Added google-services plugin
- `android/app/build.gradle` - Applied google-services plugin
- `android/app/google-services.json` - Placeholder (replace with real)
- `android/app/src/main/AndroidManifest.xml` - POST_NOTIFICATIONS permission, FCM metadata
- `lib/main.dart` - Firebase initialization on startup
- `lib/core/fcm_service.dart` - FCM service (permissions, token management, message handling)

### Config
- `config-repo/shield-notification.yml` - Firebase config properties
- `shield-notification/src/main/resources/application.yml` - Default Firebase config
