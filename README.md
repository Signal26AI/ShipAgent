# ⚓ ShipAgent

AI-powered App Store review agent — catch rejection risks before you submit.

**One command. It scans your iOS project and outputs a risk report.**

## Why

- 25% of App Store submissions get rejected (1.93M out of 7.77M in 2024)
- 40% of rejections are preventable "App Completeness" issues
- Average rejection cycle adds 3-14 days to your launch timeline
- Developers discover issues one at a time, each cycle

ShipAgent catches these before you submit.

## Quick Start

```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# Review your iOS project
npx shipagent review ./path/to/your/ios-project
```

## What It Checks

ShipAgent systematically reviews your project against Apple's App Store Review Guidelines:

| Category | What It Finds |
|----------|---------------|
| 🔒 **Privacy** | Missing privacy manifest, vague permission strings, undeclared tracking, missing ATT |
| ✅ **Completeness** | Placeholder content, broken links, test data, missing resources |
| 📝 **Metadata** | Inaccurate descriptions, platform references, misleading content |
| 💳 **Payments** | Missing IAP, no restore purchases, unclear subscription terms |
| 🔑 **Authentication** | Missing Sign in with Apple when using third-party login |
| 🎨 **Design** | Minimum functionality, iPad support, HIG compliance |
| ⚙️ **Background** | Unjustified background mode declarations |
| 📄 **Legal** | Copyright/trademark issues |

## Output

```
╔══════════════════════════════════════════════════════════╗
║  ⚓ ShipAgent — App Store Review Report                  ║
╚══════════════════════════════════════════════════════════╝

Summary
  🔴 3 High Risk    🟡 4 Medium Risk    🟢 5 Passed

────────────────────────────────────────────────────────────

🔴 HIGH RISK — Missing Privacy Manifest
   Guideline 5.1.2(i) · Confidence: 95%
   No PrivacyInfo.xcprivacy file found. Required since iOS 17.
   Fix: Create a PrivacyInfo.xcprivacy file declaring your privacy practices.

🟡 MEDIUM RISK — Vague Permission Strings
   Guideline 5.1.1 · Confidence: 72%
   NSCameraUsageDescription is too generic: "This app needs camera access."
   Fix: Explain the specific feature that uses the camera.

🟢 PASSED — Sign in with Apple
   Guideline 5.3.4 · Confidence: 15%
   Sign in with Apple entitlement found.
```

## Options

```bash
# Review current directory
shipagent review

# Review specific path
shipagent review ./MyApp

# JSON output for CI/CD
shipagent review --json ./MyApp
```

## How It Works

1. **Project Reader** — Parses Info.plist, entitlements, privacy manifest, source files
2. **Knowledge Base** — 40+ rejection patterns built from Apple's guidelines and real developer experiences
3. **AI Review Agent** — Claude systematically checks each guideline, reads relevant files, cross-references patterns
4. **Risk Report** — Confidence-scored findings with specific fix suggestions

## Requirements

- Node.js 18+
- `ANTHROPIC_API_KEY` environment variable (get one at [console.anthropic.com](https://console.anthropic.com))
- An iOS project with `.xcodeproj`

## Architecture

```
shipagent/
├── src/
│   ├── cli.ts          — CLI entry point
│   ├── reader.ts       — iOS project file reader
│   ├── agent.ts        — Claude Agent SDK integration
│   ├── report.ts       — Terminal report formatter
│   └── kb/
│       ├── guidelines.json  — Apple review guidelines
│       └── patterns.json    — 40+ rejection patterns
└── test-project/       — Mock project with intentional issues
```

## Contributing

ShipAgent is open source. Contributions welcome — especially new rejection patterns for the knowledge base.

## License

MIT
