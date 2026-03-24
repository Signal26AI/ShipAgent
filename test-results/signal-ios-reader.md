# signal-ios — Reader Output

## Project: Signal
Path: /root/.openclaw/workspace-cole/Signal-iOS
Bundle ID: $(PRODUCT_BUNDLE_IDENTIFIER)
Display Name: SignalNSE
Xcode Project: /root/.openclaw/workspace-cole/Signal-iOS/Signal.xcodeproj
Source Files: 2333 files

### Permissions Requested
None declared in Info.plist

### Background Modes
None

### Entitlements / Capabilities
aps-environment, com.apple.developer.associated-domains, com.apple.developer.default-data-protection, com.apple.developer.icloud-container-identifiers, com.apple.developer.in-app-payments, com.apple.developer.networking.carrier-constrained.app-optimized, com.apple.developer.networking.carrier-constrained.appcategory, com.apple.developer.pushkit.unrestricted-voip, com.apple.developer.ubiquity-kvstore-identifier, com.apple.developer.usernotifications.communication, com.apple.security.application-groups, keychain-access-groups

### Privacy Manifest
✅ PrivacyInfo.xcprivacy found
```json
{
  "NSPrivacyTracking": false,
  "NSPrivacyTrackingDomains": [],
  "NSPrivacyAccessedAPITypes": [
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
      "NSPrivacyAccessedAPITypeReasons": [
        "C617.1",
        "3B52.1"
      ]
    },
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace",
      "NSPrivacyAccessedAPITypeReasons": [
        "E174.1"
      ]
    },
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
      "NSPrivacyAccessedAPITypeReasons": [
        "CA92.1",
        "1C8F.1"
      ]
    }
  ],
  "NSPrivacyCollectedDataTypes": [
    {
      "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhoneNumber",
      "NSPrivacyCollectedDataTypeLinked": false,
      "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": [
        "NSPrivacyCollectedDataTypePurposeAppFunctionality"
      ]
    }
  ]
}
```

### Frameworks Linked
Pods_Signal, Pods_SignalServiceKitTests, Pods_SignalTests, Intents, CloudKit, SignalUI, Photos, Metal, MetalKit, Contacts, Pods_SignalNSE, StoreKit, Pods_SignalUI, CoreServices, MediaPlayer, Pods_SignalShareExtension, QuartzCore, Security, CoreGraphics, AudioToolbox, XCTest, ContactsUI, PushKit, MessageUI, Pods_SignalServiceKit, CFNetwork, SystemConfiguration, CoreTelephony, AVFoundation, UIKit, Foundation, Pods_SignalUITests, SignalServiceKit, CoreMedia, wrapper, MobileCoreServices, AddressBook, AddressBookUI, CoreFoundation, Social, type, GRDB, LibSignalClient, Reachability, SDWebImage, SDWebImageWebPCoder, SQLCipher, SignalRingRTC, SwiftProtobuf, blurhash, libPhoneNumber_iOS, libwebp, BonMot, LibMobileCoin, Logging, MobileCoin, PureLayout, Lottie, CocoaLumberjack, WebRTC

### In-App Purchase: Yes (entitlement found)

### Full Info.plist
```json
{
  "CFBundleDevelopmentRegion": "$(DEVELOPMENT_LANGUAGE)",
  "CFBundleDisplayName": "SignalNSE",
  "CFBundleExecutable": "$(EXECUTABLE_NAME)",
  "CFBundleIdentifier": "$(PRODUCT_BUNDLE_IDENTIFIER)",
  "CFBundleInfoDictionaryVersion": "6.0",
  "CFBundleName": "$(PRODUCT_NAME)",
  "CFBundlePackageType": "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
  "CFBundleShortVersionString": "7.96",
  "CFBundleVersion": "0",
  "NSAppTransportSecurity": {
    "NSExceptionDomains": {
      "signal.org": {
        "NSExceptionAllowsInsecureHTTPLoads": true,
        "NSIncludesSubdomains": true
      }
    }
  },
  "NSExtension": {
    "NSExtensionPointIdentifier": "com.apple.usernotifications.service",
    "NSExtensionPrincipalClass": "$(PRODUCT_MODULE_NAME).NotificationService"
  },
  "OWSBundleIDPrefix": "$(SIGNAL_BUNDLEID_PREFIX)",
  "OWSMerchantID": "$(SIGNAL_MERCHANTID)"
}
```

## Raw Metadata
```json
{
  "projectName": "Signal",
  "bundleId": "$(PRODUCT_BUNDLE_IDENTIFIER)",
  "displayName": "SignalNSE",
  "permissions": {},
  "backgroundModes": [],
  "capabilities": [
    "aps-environment",
    "com.apple.developer.associated-domains",
    "com.apple.developer.default-data-protection",
    "com.apple.developer.icloud-container-identifiers",
    "com.apple.developer.in-app-payments",
    "com.apple.developer.networking.carrier-constrained.app-optimized",
    "com.apple.developer.networking.carrier-constrained.appcategory",
    "com.apple.developer.pushkit.unrestricted-voip",
    "com.apple.developer.ubiquity-kvstore-identifier",
    "com.apple.developer.usernotifications.communication",
    "com.apple.security.application-groups",
    "keychain-access-groups"
  ],
  "hasIAP": true,
  "frameworks": [
    "Pods_Signal",
    "Pods_SignalServiceKitTests",
    "Pods_SignalTests",
    "Intents",
    "CloudKit",
    "SignalUI",
    "Photos",
    "Metal",
    "MetalKit",
    "Contacts",
    "Pods_SignalNSE",
    "StoreKit",
    "Pods_SignalUI",
    "CoreServices",
    "MediaPlayer",
    "Pods_SignalShareExtension",
    "QuartzCore",
    "Security",
    "CoreGraphics",
    "AudioToolbox",
    "XCTest",
    "ContactsUI",
    "PushKit",
    "MessageUI",
    "Pods_SignalServiceKit",
    "CFNetwork",
    "SystemConfiguration",
    "CoreTelephony",
    "AVFoundation",
    "UIKit",
    "Foundation",
    "Pods_SignalUITests",
    "SignalServiceKit",
    "CoreMedia",
    "wrapper",
    "MobileCoreServices",
    "AddressBook",
    "AddressBookUI",
    "CoreFoundation",
    "Social",
    "type",
    "GRDB",
    "LibSignalClient",
    "Reachability",
    "SDWebImage",
    "SDWebImageWebPCoder",
    "SQLCipher",
    "SignalRingRTC",
    "SwiftProtobuf",
    "blurhash",
    "libPhoneNumber_iOS",
    "libwebp",
    "BonMot",
    "LibMobileCoin",
    "Logging",
    "MobileCoin",
    "PureLayout",
    "Lottie",
    "CocoaLumberjack",
    "WebRTC"
  ],
  "sourceFiles": 2333,
  "infoPlistPath": "/root/.openclaw/workspace-cole/Signal-iOS/SignalNSE/Info.plist",
  "entitlementsPath": "/root/.openclaw/workspace-cole/Signal-iOS/Signal/Signal-AppStore.entitlements",
  "privacyManifestPath": "/root/.openclaw/workspace-cole/Signal-iOS/Signal/PrivacyInfo.xcprivacy",
  "xcodeProjectPath": "/root/.openclaw/workspace-cole/Signal-iOS/Signal.xcodeproj"
}
```
