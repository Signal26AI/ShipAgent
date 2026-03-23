import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";
import plist from "plist";

export interface ProjectMetadata {
  projectPath: string;
  projectName: string;
  bundleId?: string;
  displayName?: string;
  deploymentTarget?: string;
  deviceFamily?: string[];
  infoPlist: Record<string, unknown> | null;
  infoPlistPath: string | null;
  entitlements: Record<string, unknown> | null;
  entitlementsPath: string | null;
  privacyManifest: Record<string, unknown> | null;
  privacyManifestPath: string | null;
  permissions: Record<string, string>;
  backgroundModes: string[];
  capabilities: string[];
  hasIAP: boolean;
  frameworks: string[];
  xcodeProjectPath: string | null;
  sourceFiles: string[];
}

function findFile(
  dir: string,
  patterns: string[],
): { path: string; content: string } | null {
  for (const pattern of patterns) {
    const matches = fg.sync(pattern, {
      cwd: dir,
      absolute: true,
      deep: 5,
      ignore: ["**/Pods/**", "**/build/**", "**/.build/**", "**/DerivedData/**"],
    });
    if (matches.length > 0) {
      try {
        return { path: matches[0], content: fs.readFileSync(matches[0], "utf-8") };
      } catch {
        continue;
      }
    }
  }
  return null;
}

function parsePlist(content: string): Record<string, unknown> | null {
  try {
    return plist.parse(content) as Record<string, unknown>;
  } catch {
    // Try binary plist or malformed XML — return null
    return null;
  }
}

function extractPermissions(infoPlist: Record<string, unknown>): Record<string, string> {
  const permissions: Record<string, string> = {};
  const permissionKeys = [
    "NSCameraUsageDescription",
    "NSMicrophoneUsageDescription",
    "NSPhotoLibraryUsageDescription",
    "NSPhotoLibraryAddUsageDescription",
    "NSLocationWhenInUseUsageDescription",
    "NSLocationAlwaysUsageDescription",
    "NSLocationAlwaysAndWhenInUseUsageDescription",
    "NSContactsUsageDescription",
    "NSCalendarsUsageDescription",
    "NSRemindersUsageDescription",
    "NSMotionUsageDescription",
    "NSSpeechRecognitionUsageDescription",
    "NSFaceIDUsageDescription",
    "NSBluetoothAlwaysUsageDescription",
    "NSBluetoothPeripheralUsageDescription",
    "NSHealthShareUsageDescription",
    "NSHealthUpdateUsageDescription",
    "NSHomeKitUsageDescription",
    "NSAppleMusicUsageDescription",
    "NSSiriUsageDescription",
    "NSUserTrackingUsageDescription",
    "NSLocalNetworkUsageDescription",
    "NSNearbyInteractionUsageDescription",
  ];

  for (const key of permissionKeys) {
    if (typeof infoPlist[key] === "string") {
      permissions[key] = infoPlist[key] as string;
    }
  }
  return permissions;
}

export function readProject(projectPath: string): ProjectMetadata {
  const absPath = path.resolve(projectPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Project path does not exist: ${absPath}`);
  }

  // Find .xcodeproj
  const xcodeProjects = fg.sync("**/*.xcodeproj", {
    cwd: absPath,
    onlyDirectories: true,
    deep: 2,
    ignore: ["**/Pods/**"],
  });
  const xcodeProjectPath = xcodeProjects[0]
    ? path.join(absPath, xcodeProjects[0])
    : null;
  const projectName = xcodeProjectPath
    ? path.basename(xcodeProjectPath, ".xcodeproj")
    : path.basename(absPath);

  // Find Info.plist
  const infoPlistFile = findFile(absPath, [
    "**/Info.plist",
    `**/${projectName}/Info.plist`,
    "**/Supporting Files/Info.plist",
  ]);
  const infoPlist = infoPlistFile ? parsePlist(infoPlistFile.content) : null;

  // Find entitlements
  const entFile = findFile(absPath, [
    "**/*.entitlements",
    `**/${projectName}/*.entitlements`,
  ]);
  const entitlements = entFile ? parsePlist(entFile.content) : null;

  // Find privacy manifest
  const privacyFile = findFile(absPath, [
    "**/PrivacyInfo.xcprivacy",
    `**/${projectName}/PrivacyInfo.xcprivacy`,
  ]);
  const privacyManifest = privacyFile ? parsePlist(privacyFile.content) : null;

  // Extract data from Info.plist
  const permissions = infoPlist ? extractPermissions(infoPlist) : {};
  const backgroundModes = infoPlist
    ? ((infoPlist["UIBackgroundModes"] as string[]) || [])
    : [];
  const bundleId = infoPlist
    ? (infoPlist["CFBundleIdentifier"] as string)
    : undefined;
  const displayName = infoPlist
    ? ((infoPlist["CFBundleDisplayName"] as string) ||
       (infoPlist["CFBundleName"] as string))
    : undefined;
  const deploymentTarget = infoPlist
    ? (infoPlist["MinimumOSVersion"] as string)
    : undefined;
  const deviceFamilyRaw = infoPlist
    ? (infoPlist["UIDeviceFamily"] as number[])
    : undefined;
  const deviceFamily = deviceFamilyRaw
    ? deviceFamilyRaw.map((f) => (f === 1 ? "iPhone" : f === 2 ? "iPad" : `Unknown(${f})`))
    : undefined;

  // Extract capabilities from entitlements
  const capabilities = entitlements ? Object.keys(entitlements) : [];
  const hasIAP = capabilities.some(
    (c) =>
      c.includes("in-app-payments") ||
      c.includes("com.apple.developer.storekit"),
  );

  // Find frameworks linked
  const pbxproj = findFile(absPath, ["**/*.xcodeproj/project.pbxproj"]);
  const frameworks: string[] = [];
  if (pbxproj) {
    const frameworkRegex = /(\w+)\.framework/g;
    let match;
    while ((match = frameworkRegex.exec(pbxproj.content)) !== null) {
      if (!frameworks.includes(match[1])) {
        frameworks.push(match[1]);
      }
    }
  }

  // Find source files
  const sourceFiles = fg.sync(["**/*.swift", "**/*.m", "**/*.h"], {
    cwd: absPath,
    deep: 5,
    ignore: ["**/Pods/**", "**/build/**", "**/.build/**", "**/DerivedData/**"],
  });

  return {
    projectPath: absPath,
    projectName,
    bundleId,
    displayName,
    deploymentTarget,
    deviceFamily,
    infoPlist,
    infoPlistPath: infoPlistFile?.path ?? null,
    entitlements,
    entitlementsPath: entFile?.path ?? null,
    privacyManifest,
    privacyManifestPath: privacyFile?.path ?? null,
    permissions,
    backgroundModes,
    capabilities,
    hasIAP,
    frameworks,
    xcodeProjectPath,
    sourceFiles,
  };
}

export function formatMetadataForAgent(meta: ProjectMetadata): string {
  const lines: string[] = [];
  lines.push(`## Project: ${meta.projectName}`);
  lines.push(`Path: ${meta.projectPath}`);
  if (meta.bundleId) lines.push(`Bundle ID: ${meta.bundleId}`);
  if (meta.displayName) lines.push(`Display Name: ${meta.displayName}`);
  if (meta.deploymentTarget) lines.push(`Deployment Target: iOS ${meta.deploymentTarget}`);
  if (meta.deviceFamily) lines.push(`Device Family: ${meta.deviceFamily.join(", ")}`);
  lines.push(`Xcode Project: ${meta.xcodeProjectPath ?? "Not found"}`);
  lines.push(`Source Files: ${meta.sourceFiles.length} files`);

  lines.push("\n### Permissions Requested");
  if (Object.keys(meta.permissions).length === 0) {
    lines.push("None declared in Info.plist");
  } else {
    for (const [key, value] of Object.entries(meta.permissions)) {
      lines.push(`- **${key}**: "${value}"`);
    }
  }

  lines.push("\n### Background Modes");
  if (meta.backgroundModes.length === 0) {
    lines.push("None");
  } else {
    lines.push(meta.backgroundModes.join(", "));
  }

  lines.push("\n### Entitlements / Capabilities");
  if (meta.capabilities.length === 0) {
    lines.push("None found (no .entitlements file)");
  } else {
    lines.push(meta.capabilities.join(", "));
  }

  lines.push("\n### Privacy Manifest");
  if (meta.privacyManifest) {
    lines.push("✅ PrivacyInfo.xcprivacy found");
    lines.push("```json\n" + JSON.stringify(meta.privacyManifest, null, 2) + "\n```");
  } else {
    lines.push("❌ PrivacyInfo.xcprivacy NOT found");
  }

  lines.push("\n### Frameworks Linked");
  if (meta.frameworks.length === 0) {
    lines.push("Could not detect (no .pbxproj found)");
  } else {
    lines.push(meta.frameworks.join(", "));
  }

  lines.push(`\n### In-App Purchase: ${meta.hasIAP ? "Yes (entitlement found)" : "Not detected in entitlements"}`);

  if (meta.infoPlist) {
    lines.push("\n### Full Info.plist");
    lines.push("```json\n" + JSON.stringify(meta.infoPlist, null, 2) + "\n```");
  }

  return lines.join("\n");
}
