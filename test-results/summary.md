# ShipAgent Integration Test Summary

**Date:** 2026-03-23
**Test scope:** Reader-only (no AI review — ANTHROPIC_API_KEY not available in subagent environment)
**Projects tested:** 5 (3 our own, 2 approved App Store apps)

## Results Matrix

| Project | Xcode Found | Info.plist | Permissions | Entitlements | Privacy Manifest | Frameworks | Source Files |
|---------|------------|------------|-------------|-------------|-----------------|------------|-------------|
| EdoTime | ✅ | ✅ (minimal) | 0 (correct) | None | ❌ Missing | None (SPM) | 10 |
| Beacon | ✅ | ❌ Missing | 0 (unknown) | None | ❌ Missing | None (SPM) | 58 |
| VibeEdit | ✅ | ✅ (good) | 3 ✅ | None | ❌ Missing | None (SPM) | 19 |
| Signal iOS | ✅ | ⚠️ Wrong one | 0 ❌ (6 exist) | 12 ✅ | ✅ Found | 47 ✅ | 2,333 |
| isowords | ✅ | ✅ (good) | 0 (correct) | 3 ✅ | ❌ Missing | 3 (1 fake) | 389 |

## Key Findings

### 1. Reader Strengths
- **Xcode project detection**: 5/5 — works perfectly, even nested paths
- **Entitlements parsing**: Excellent when .entitlements file exists
- **Privacy manifest parsing**: Correctly parsed Signal's PrivacyInfo.xcprivacy
- **Framework detection (CocoaPods)**: Works well for Pods-based projects (Signal)
- **Permission extraction**: Perfect when Info.plist exists with permissions (VibeEdit)

### 2. Critical Reader Bugs

#### Bug #1: Wrong Info.plist Selection (HIGH)
**Project:** Signal iOS
**Problem:** Reader glob `**/Info.plist` found `SignalNSE/Info.plist` (Notification Service Extension) before the main app's `Signal/Signal-Info.plist`. The pattern `{ProjectName}-Info.plist` is extremely common in iOS projects but not searched.
**Impact:** All main-app metadata was wrong — zero permissions, zero background modes, wrong display name.
**Fix:** Add `**/{ProjectName}-Info.plist` and `**/*-Info.plist` to search patterns. Prefer plists in directories matching the project name. Deprioritize extension directories (NSE, ShareExtension, etc.)

#### Bug #2: No SPM Dependency Detection (MEDIUM)
**Projects:** EdoTime, Beacon, VibeEdit, isowords (all SPM-based)
**Problem:** Reader only detects `.framework` references in pbxproj. Modern Swift projects use SPM exclusively — reader sees zero dependencies.
**Fix:** Parse `Package.swift`, `Package.resolved`, or `.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` for SPM dependencies.

#### Bug #3: Misleading "No .pbxproj found" Message (LOW)
**Projects:** EdoTime, Beacon, VibeEdit
**Problem:** `formatMetadataForAgent()` says "Could not detect (no .pbxproj found)" when frameworks array is empty. But the pbxproj *was* found — it just had no `.framework` references (SPM project).
**Fix:** Separate the messages: "No .pbxproj found" vs "No .framework references in project file (may use SPM)"

#### Bug #4: Framework Regex False Positives (LOW)
**Projects:** Signal, isowords
**Problem:** Regex `/(\w+)\.framework/g` matches structural pbxproj tokens like `wrapper.framework` and `type.framework`
**Fix:** Filter out known false positives or use a more targeted regex that looks at PBXFrameworksBuildPhase sections only.

### 3. Missing Features

| Feature | Impact | Difficulty |
|---------|--------|-----------|
| SPM dependency detection | HIGH — most modern apps use SPM | Medium |
| Multi-target Info.plist selection | HIGH — large apps have multiple targets | Medium |
| Source code analysis (import scanning) | MEDIUM — detect framework usage from imports | Easy |
| Xcode build settings parsing | MEDIUM — deployment target, generated plist values | Hard |
| CocoaPods Podfile parsing | LOW — supplement pbxproj detection | Easy |
| App Clip detection | LOW — isowords has one, could flag special rules | Easy |

## Accuracy Assessment

### Reader accuracy by feature:
| Feature | Accuracy | Notes |
|---------|----------|-------|
| Project detection | 5/5 (100%) | Always finds xcodeproj |
| Info.plist finding | 3/5 (60%) | Missed Beacon entirely, wrong one for Signal |
| Permission extraction | 1/2 (50%) | Perfect when plist found with permissions. Failed when plist is wrong/missing |
| Entitlements | 2/2 (100%) | Both projects with entitlements parsed correctly |
| Privacy manifest | 1/1 (100%) | Found and parsed Signal's correctly |
| Framework detection | 2/5 (40%) | Only works for CocoaPods projects with .framework refs |

### Overall: The reader works for simple projects but has critical gaps for:
1. **Multi-target projects** (like Signal) — wrong plist selection
2. **SPM-only projects** — zero dependency detection
3. **Xcode-managed plists** — no Info.plist on disk (Beacon)

## False Positive Risk Assessment

Without the AI review, we can estimate the cascade effect:

| Issue | Would Cause False Positive? | Severity |
|-------|---------------------------|----------|
| Wrong Info.plist (Signal) | YES — agent would flag "missing permissions" when they exist | Critical |
| No SPM detection | Maybe — agent might miss dependency-related issues | Medium |
| Missing plist (Beacon) | YES — agent has no metadata to work with | High |
| Framework regex noise | Low — "wrapper" framework unlikely to trigger rules | Low |

**Estimated false positive rate for approved apps:** **HIGH** due to the Signal Info.plist bug. If the reader feeds wrong metadata to the AI agent, the review will flag many non-issues. This must be fixed before the review agent can be trusted.

## Recommendations

### Priority fixes before shipping:
1. **Fix Info.plist selection logic** — search for `{ProjectName}-Info.plist`, prefer main app target directory
2. **Add SPM dependency detection** — parse Package.resolved
3. **Fix misleading error messages** — distinguish "not found" from "found but empty"

### Nice-to-have:
4. Add source code import scanning (`import Framework` → detect usage)
5. Filter framework regex false positives
6. Support Xcode-generated Info.plist (parse build settings)

## Test Environment
- **Machine:** Linux x86_64 (Node.js v22.22.0)
- **ShipAgent version:** 0.1.0
- **Branch:** feat/fix-agent
- **AI review:** Not run (ANTHROPIC_API_KEY not in subagent environment)
