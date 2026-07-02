# Build and Deployment Guide

## Prerequisites

1. **Expo Account**: Create an account at https://expo.dev/signup
2. **EAS CLI**: Already available via npx

## Setup Steps

### 1. Login to EAS
```bash
npx eas-cli login
```
Enter your Expo credentials when prompted.

### 2. Initialize EAS Project
```bash
npx eas-cli init --id a32a8c02-5697-453d-8c32-22b8106bbcd1
```

### 3. Configure Build Settings (Optional)
Create `eas.json` if you want to customize build settings:
```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "buildConfiguration": "Release"
      }
    }
  }
}
```

## Build and Deploy

### Build for Android (Recommended to Start)

**Build Android APK (easiest for testing):**
```bash
npx eas-cli build --platform android --profile preview
```

**Build and Submit to Google Play Store:**
```bash
npx eas-cli build --platform android --auto-submit
```

**Just Build (no submission):**
```bash
npx eas-cli build --platform android
```

The APK/AAB will be available for download from your Expo dashboard at:
https://expo.dev/accounts/[your-account]/projects/lyric-chord-composer/builds

### Build for iOS (Requires Apple Developer Account)

**iOS Only:**
```bash
npx eas-cli build --platform ios
```

**Build and Submit to App Store:**
```bash
npx eas-cli build --platform ios --auto-submit
```

### Build for All Platforms

**Build for Both iOS and Android:**
```bash
npx eas-cli build --platform all --auto-submit
```

This command will:
- Build for iOS (App Store)
- Build for Android (Google Play Store)
- Automatically submit to both app stores (requires store credentials)

### Run on Web (Local Development)

**Web:**
```bash
npm run web
```

## App Store Requirements

### iOS App Store
- Apple Developer Account ($99/year)
- App Store Connect credentials
- App bundle identifier
- Required app metadata and screenshots

### Google Play Store
- Google Play Developer Account ($25 one-time)
- Play Console credentials
- Signed APK or App Bundle
- Required app metadata and screenshots

## Build Configuration

The build will use settings from:
- `app.json` - Expo configuration
- `eas.json` - EAS Build configuration (optional)
- Environment variables in `.env.local` (if configured)

## Notes

- First build may take 10-20 minutes
- Subsequent builds are faster due to caching
- Auto-submit requires store credentials to be configured in EAS
- You can monitor builds at https://expo.dev/accounts/[your-account]/projects/lyric-chord-composer/builds

## Current Features Ready for Deployment

✅ **Phase 1 Complete:**
- Composition creation and management
- Export/Import with `.hmlcc` file format
- Local caching with AsyncStorage
- Cross-platform support (iOS, Android, Web)
- Material Design UI with React Native Paper

✅ **File Format:**
- Custom `.hmlcc` extension (Heath Morris Lyric Chord Composer)
- JSON-based for human readability
- Complete composition data including sections, chords, and settings

## Future Enhancements

🔜 **Phase 2 (Not Yet Implemented):**
- Google Drive integration for cloud sync
- OAuth authentication
- Real-time synchronization
- Collaboration features
- Version history

## Troubleshooting

**Build fails:**
- Ensure you're logged in: `npx eas-cli whoami`
- Check project is initialized: verify `app.json` has correct slug
- Review build logs at expo.dev

**Auto-submit fails:**
- Store credentials must be configured in EAS
- Use manual submission as alternative
- Download builds and upload manually to stores

## Manual Store Submission

If auto-submit doesn't work:

1. **Build without auto-submit:**
   ```bash
   npx eas-cli build --platform all
   ```

2. **Download builds from expo.dev**

3. **Upload manually:**
   - iOS: Use Transporter app or Xcode
   - Android: Upload to Google Play Console

## Testing Builds

**Internal Testing:**
```bash
npx eas-cli build --profile preview --platform android
```

**Development Build:**
```bash
npx eas-cli build --profile development --platform android
```

This allows testing on physical devices before production release.
