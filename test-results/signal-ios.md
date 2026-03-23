# Signal iOS — Integration Test Results

## Project Info
- **Path:** /root/.openclaw/workspace-cole/Signal-iOS/
- **Type:** Messaging app (Signal Private Messenger)
- **Status:** ✅ Approved on App Store (millions of users)

## Reader Output

### What the reader found:
| Field | Value |
|-------|-------|
| Project Name | Signal |
| Bundle ID | $(PRODUCT_BUNDLE_IDENTIFIER) |
| Display Name | SignalNSE ⚠️ |
| Deployment Target | *(not found)* |
| Xcode Project | ✅ Signal.xcodeproj |
| Source Files | 2,333 |
| Permissions | None ❌ |
| Background Modes | None ❌ |
| Entitlements | 12 capabilities (see below) |
| Privacy Manifest | ✅ Found |
| Frameworks | 47 frameworks detected |
| IAP | Yes (in-app-payments entitlement) |

### Entitlements/Capabilities:
- aps-environment
- com.apple.developer.associated-domains
- com.apple.developer.default-data-protection
- com.apple.developer.icloud-container-identifiers
- com.apple.developer.in-app-payments
- com.apple.developer.networking.carrier-constrained.app-optimized
- com.apple.developer.networking.carrier-constrained.appcategory
- com.apple.developer.pushkit.unrestricted-voip
- com.apple.developer.ubiquity-kvstore-identifier
- com.apple.developer.usernotifications.communication
- com.apple.security.application-groups
- keychain-access-groups

### Privacy Manifest:
```json
{
  "NSPrivacyTracking": false,
  "NSPrivacyTrackingDomains": [],
  "NSPrivacyAccessedAPITypes": [
    {"NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp", "NSPrivacyAccessedAPITypeReasons": ["C617.1", "3B52.1"]},
    {"NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace", "NSPrivacyAccessedAPITypeReasons": ["E174.1"]},
    {"NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults", "NSPrivacyAccessedAPITypeReasons": ["CA92.1", "1C8F.1"]}
  ],
  "NSPrivacyCollectedDataTypes": [
    {"NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhoneNumber", "NSPrivacyCollectedDataTypeLinked": false, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]}
  ]
}
```

### Key Frameworks Detected (partial):
AVFoundation, Contacts, ContactsUI, Photos, StoreKit, PushKit, CloudKit, GameKit(?), Metal, MetalKit, CoreTelephony, WebRTC, SignalRingRTC, LibSignalClient, MobileCoin, LibMobileCoin, Lottie, SDWebImage, CocoaLumberjack, GRDB, SQLCipher, SwiftProtobuf

## Reader Assessment

### Critical Bug — Wrong Info.plist:
- ❌ **Reader picked up `SignalNSE/Info.plist`** (Notification Service Extension) instead of **`Signal/Signal-Info.plist`** (main app)
- This caused:
  - Display name showing as "SignalNSE" instead of "Signal"
  - **Zero permissions detected** — but the main app declares 6 permissions:
    - NSCameraUsageDescription
    - NSMicrophoneUsageDescription
    - NSPhotoLibraryUsageDescription
    - NSPhotoLibraryAddUsageDescription
    - NSContactsUsageDescription
    - NSLocationWhenInUseUsageDescription
  - **Zero background modes** — but the main app declares UIBackgroundModes
  - No URL schemes, launch storyboard, or other main-app metadata

### What it got right:
- ✅ Found xcodeproj
- ✅ Found and parsed privacy manifest correctly
- ✅ Found entitlements with rich capabilities list
- ✅ Framework detection worked well (47 frameworks from Pods + native)
- ✅ Detected IAP capability
- ✅ Large source file count (2,333) is realistic for Signal

### Reader bugs exposed:
1. **Info.plist selection**: Glob `**/Info.plist` finds NSE plist first, missing `Signal-Info.plist` (common naming pattern)
2. **Should prefer main target plist**: Need heuristic — prefer plist in dir matching project name, or prefer `{ProjectName}-Info.plist`
3. **NSE plist = extension metadata**: Very misleading to use extension plist as the app's metadata

### Framework detection notes:
- Detected some noise: `Pods_Signal`, `Pods_SignalUI`, etc. (pod aggregate targets, not real frameworks)
- `wrapper` and `type` detected as frameworks (regex false positives from pbxproj structure)
- Real frameworks correctly identified: AVFoundation, WebRTC, GRDB, etc.

## Full Review (AI Agent)
**Not run** — ANTHROPIC_API_KEY not available in subagent environment.

### Hypothetical false positive concerns:
Given the wrong Info.plist was read, a review would likely produce many false flags:
- "Missing permissions" — but they exist in the correct plist
- "No background modes" — but the app uses them
- ATS exception for signal.org would be flagged (but is legitimate for their infrastructure)
- IAP + many capabilities would generate noise

**The wrong-plist bug would cascade into massive false positives for the full review.**
