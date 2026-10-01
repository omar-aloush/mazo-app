# Mazō Home Screen Widget Setup

## iOS Widget Setup (after `npx expo prebuild`)

1. **Open in Xcode**: Open `ios/mazo.xcworkspace` in Xcode

2. **Add Widget Extension**:
   - File → New → Target → Widget Extension
   - Name: `MazoWidget`
   - Uncheck "Include Configuration Intent"
   - Click Finish

3. **Replace Widget Code**:
   - Delete the auto-generated Swift files in the `MazoWidget` folder
   - Copy `widgets/ios/MazoWidget.swift` into the `MazoWidget` target

4. **Add App Group** (for shared data):
   - Select the **main app target** → Signing & Capabilities → + Capability → App Groups
   - Add: `group.app.rork.mazo`
   - Select the **MazoWidget target** → same steps, same group name

5. **Build**: `eas build --platform ios`

## Android Widget Setup

The Android widget is **automatically configured** by the Expo config plugin (`plugins/withMazoWidget.js`).

After running `npx expo prebuild`, you need to manually copy:
- `widgets/android/MazoWidgetProvider.kt` → `android/app/src/main/java/app/rork/mazo/widget/`
- `widgets/android/mazo_widget.xml` → `android/app/src/main/res/layout/`
- `widgets/android/mazo_widget_info.xml` → `android/app/src/main/res/xml/`

Then: `eas build --platform android`

## How Data Flows

```
React Native App
    ↓ (updateWidgetData())
SharedPreferences (Android) / App Group UserDefaults (iOS)
    ↓ (read by native widget)
Home Screen Widget displays mood face
```

The widget refreshes every 15 minutes automatically, or when the app updates the shared data.
