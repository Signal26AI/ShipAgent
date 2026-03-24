# isowords — Integration Test Results

## Project Info
- **Path:** /root/.openclaw/workspace-cole/isowords/
- **Type:** 3D word puzzle game by Point-Free
- **Status:** ✅ Approved on App Store

## Reader Output

### What the reader found:
| Field | Value |
|-------|-------|
| Project Name | isowords |
| Bundle ID | $(PRODUCT_BUNDLE_IDENTIFIER) |
| Display Name | isowords |
| Deployment Target | *(not found)* |
| Xcode Project | ✅ App/isowords.xcodeproj |
| Source Files | 389 |
| Permissions | None |
| Background Modes | None |
| Entitlements | 3 capabilities |
| Privacy Manifest | ❌ Not found |
| Frameworks | 3 (GameKit, wrapper, StoreKit) |
| IAP | No (not in entitlements) |

### Entitlements:
- com.apple.developer.associated-domains
- com.apple.developer.parent-application-identifiers
- com.apple.security.application-groups

### Info.plist:
- Standard bundle keys present
- NSAppClip section (supports App Clips)
- Multiple scene support enabled
- Portrait-only on iPhone, all orientations on iPad
- armv7 required

## Reader Assessment

### Correct:
- ✅ Found xcodeproj (nested in App/ dir)
- ✅ Parsed Info.plist successfully with rich data
- ✅ Found entitlements with 3 capabilities
- ✅ Detected GameKit and StoreKit frameworks
- ✅ 389 source files (reasonable for SPM-based modular project)
- ✅ App Clip support detected from plist

### Issues:
- ⚠️ **"wrapper" framework**: Regex false positive from pbxproj syntax, not a real framework
- ⚠️ **IAP detection missed**: StoreKit framework is linked and the app has in-app purchases on the App Store, but entitlements don't have `in-app-payments` — may use StoreKit 2 which doesn't require the entitlement
- ⚠️ **No privacy manifest**: Reader correctly flags this. isowords may have been grandfathered or may have one in a different location (SPM package-level?)
- ⚠️ **SPM packages not detected**: isowords is heavily modular (composable architecture) — all dependencies are SPM packages, none detected

### Missing detection:
- The project uses TCA (The Composable Architecture) — reader can't detect SPM dependencies
- Uses SceneKit/Metal for 3D rendering (not detected via framework linking, likely imported in source)
- Server-side component exists (not relevant for App Store review)

## Full Review (AI Agent)
**Not run** — ANTHROPIC_API_KEY not available in subagent environment.

### Hypothetical false positive concerns:
- Missing privacy manifest flag — may be a real issue or grandfathered
- StoreKit without IAP entitlement — likely StoreKit 2 (not a real issue)
- No permissions is correct — word game doesn't need camera/mic/etc.
- "wrapper" framework would confuse the review agent
