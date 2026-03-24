# EdoTime Integration Test — Real App Store Rejection Case

**Date:** 2026-03-24
**App:** EdoTime (江戸時間) — Japanese traditional time display app
**Repo:** Signal26AI/EdoTime
**Rejection:** Guideline 4.2 (Minimum Functionality) — Apple said "it's just a clock"

---

## Test Summary

| Version | Commit | Swift Files | Views | ShipLint Findings | 4.2 Flagged? |
|---------|--------|-------------|-------|-------------------|--------------|
| Pre-rejection | `fcf183d` | 6 | 3 (ClockView, ContentView, KokuDetailView) | 3 | ❌ No |
| Post-fix | `1aa931c` | 10 | 5 (+LearnView, TodayTimelineView, HourDetailSheet) | 3 (identical) | ❌ No |

**Key Result: ShipLint did NOT detect Guideline 4.2 risk on either version.**

---

## Pre-Rejection Version (commit `fcf183d`)

### ShipLint Scan Results

**3 findings:**

1. **`privacy-002-missing-location-purpose`** (critical) — Guideline 5.1.1
   - CoreLocation linked but NSLocationWhenInUseUsageDescription missing from Info.plist
   
2. **`metadata-002-missing-supported-orientations`** (medium) — Guideline 4.0
   - Missing UISupportedInterfaceOrientations key
   
3. **`config-003-missing-launch-storyboard`** (critical) — Guideline 4.0
   - Missing UILaunchStoryboardName key

**Project stats:**
- 6 Swift files total
- 2 model files (EdoTime.swift, SolarCalculator.swift)
- 3 view files (ClockView, ContentView, KokuDetailView)
- 1 app entry point (EdoTimeApp.swift)
- Frameworks: CoreLocation, Foundation, SwiftUI

### AI Agent Review
- ❌ Not available — ANTHROPIC_API_KEY not set in environment

---

## Post-Fix Version (commit `1aa931c`)

### What Changed (diff: `fcf183d..1aa931c`)
```
+2,225 lines added across 6 files:
  - NEW: Models/KokuEducationalData.swift (227 lines)
  - NEW: Views/LearnView.swift (903 lines)
  - NEW: Views/TodayTimelineView.swift (600 lines)
  - NEW: Views/HourDetailSheet.swift (414 lines)
  - MODIFIED: Views/ContentView.swift (+65 lines, added tab navigation)
  - MODIFIED: project.pbxproj (new file references)
```

**Project stats after fix:**
- 10 Swift files (was 6 → +67% more files)
- 3 model files (+KokuEducationalData)
- 5 view files (+LearnView, TodayTimelineView, HourDetailSheet)
- Significant educational content added

### ShipLint Scan Results
**3 findings — identical to pre-rejection version:**
1. `privacy-002-missing-location-purpose` (critical)
2. `metadata-002-missing-supported-orientations` (medium)
3. `config-003-missing-launch-storyboard` (critical)

### AI Agent Review
- ❌ Not available — ANTHROPIC_API_KEY not set

---

## Analysis

### What ShipLint Caught ✅
- Privacy issues (missing location usage description)
- Configuration issues (missing launch storyboard, orientations)
- These are valid findings that could cause rejection

### What ShipLint Missed ❌
- **Guideline 4.2 (Minimum Functionality)** — the actual reason Apple rejected the app
- No differentiation between the 6-file "just a clock" version and the 10-file version with educational content
- Zero findings changed between versions despite 2,225 lines of new content

### Why 4.2 Was Missed
ShipLint's current rule set (18 rules) is entirely static/deterministic:
- Privacy checks (purpose strings, ATT, permissions)
- Configuration checks (ATS, encryption, launch screen)
- Code checks (private APIs, dynamic code execution)
- Auth checks (SIWA requirement)

**There is no rule for 4.2 Minimum Functionality.** This is expected — 4.2 is inherently subjective and requires reasoning about:
- App purpose vs. feature depth
- Category risk (Utilities/Lifestyle → higher bar)
- Number of screens/features
- Whether the app "could be a website" or has native value

### Recommendations for 4.2 Detection

#### ShipLint (Static) — Heuristic Rule
A `functionality-001-minimum-functionality` rule could flag risk based on:
- **Swift file count:** <8 Swift files → warning
- **View count:** <4 SwiftUI views → warning  
- **Lines of code:** Total LOC below threshold
- **Category:** If detectable (Utilities, Lifestyle) → amplify risk
- **Single-screen detection:** Only one NavigationView/TabView entry

This wouldn't be definitive but could surface a "⚠️ Low feature count — 4.2 risk" warning.

#### AI Agent Review — Best Fit
4.2 is the strongest case for the AI agent layer. The agent should:
1. Count files, views, features
2. Read app description/purpose
3. Assess whether the app provides "unique, lasting utility" beyond a simple widget
4. Compare against known 4.2 rejection patterns (single-purpose clocks, calculators, flashlights)

This is exactly the kind of subjective assessment that static rules can't handle but an LLM can.

---

## Verdict

**ShipAgent partially validated.** ShipLint caught real issues (privacy, config) but missed the actual rejection reason (4.2). This is the expected gap — ShipLint handles deterministic rules well, but 4.2 requires the AI agent layer which couldn't be tested without an API key.

**Next steps:**
1. Add a heuristic `functionality-001-minimum-functionality` rule to ShipLint
2. Test AI agent review with ANTHROPIC_API_KEY to validate 4.2 detection
3. Ensure the AI agent's system prompt explicitly mentions 4.2 patterns
