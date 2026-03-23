import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { readProject } from "../reader.js";

const TEST_PROJECT = path.resolve(__dirname, "../../test-project");

describe("reader — readProject", () => {
  describe("Info.plist parsing", () => {
    it("correctly parses Info.plist XML plist format", () => {
      const meta = readProject(TEST_PROJECT);
      expect(meta.infoPlist).not.toBeNull();
      expect(meta.infoPlistPath).toBeTruthy();
    });

    it("extracts bundle ID", () => {
      const meta = readProject(TEST_PROJECT);
      expect(meta.bundleId).toBe("com.example.testapp");
    });

    it("extracts display name", () => {
      const meta = readProject(TEST_PROJECT);
      expect(meta.displayName).toBe("Test App");
    });

    it("extracts deployment target", () => {
      const meta = readProject(TEST_PROJECT);
      expect(meta.deploymentTarget).toBe("14.0");
    });

    it("extracts device family", () => {
      const meta = readProject(TEST_PROJECT);
      expect(meta.deviceFamily).toEqual(["iPhone", "iPad"]);
    });
  });

  describe("permission extraction", () => {
    it("extracts all NS*UsageDescription permission strings", () => {
      const meta = readProject(TEST_PROJECT);
      expect(meta.permissions).toHaveProperty("NSCameraUsageDescription");
      expect(meta.permissions).toHaveProperty("NSLocationAlwaysUsageDescription");
      expect(meta.permissions).toHaveProperty("NSLocationWhenInUseUsageDescription");
      expect(meta.permissions).toHaveProperty("NSMicrophoneUsageDescription");
      expect(meta.permissions).toHaveProperty("NSContactsUsageDescription");
      expect(Object.keys(meta.permissions).length).toBe(5);
    });

    it("returns empty permissions when Info.plist has none", () => {
      const fixturePath = path.resolve(__dirname, "../../test-fixtures/missing-privacy-manifest");
      const meta = readProject(fixturePath);
      expect(Object.keys(meta.permissions).length).toBe(0);
    });
  });

  describe("entitlements parsing", () => {
    it("finds entitlements file and parses capabilities", () => {
      const meta = readProject(TEST_PROJECT);
      expect(meta.entitlements).not.toBeNull();
      expect(meta.entitlementsPath).toBeTruthy();
      expect(meta.capabilities).toContain("com.apple.developer.applesignin");
    });

    it("returns null entitlements when no .entitlements file exists", () => {
      const fixturePath = path.resolve(__dirname, "../../test-fixtures/missing-privacy-manifest");
      const meta = readProject(fixturePath);
      expect(meta.entitlements).toBeNull();
      expect(meta.entitlementsPath).toBeNull();
      expect(meta.capabilities).toEqual([]);
    });
  });

  describe("privacy manifest", () => {
    it("finds PrivacyInfo.xcprivacy and parses it", () => {
      const fixturePath = path.resolve(__dirname, "../../test-fixtures/clean-project");
      const meta = readProject(fixturePath);
      expect(meta.privacyManifest).not.toBeNull();
      expect(meta.privacyManifestPath).toBeTruthy();
      expect(meta.privacyManifest).toHaveProperty("NSPrivacyTracking");
    });

    it("returns null when no privacy manifest exists", () => {
      const fixturePath = path.resolve(__dirname, "../../test-fixtures/missing-privacy-manifest");
      const meta = readProject(fixturePath);
      expect(meta.privacyManifest).toBeNull();
      expect(meta.privacyManifestPath).toBeNull();
    });
  });

  describe("background modes", () => {
    it("extracts UIBackgroundModes array", () => {
      const meta = readProject(TEST_PROJECT);
      expect(meta.backgroundModes).toEqual(["audio", "location", "voip", "fetch"]);
    });

    it("returns empty array when no background modes", () => {
      const fixturePath = path.resolve(__dirname, "../../test-fixtures/clean-project");
      const meta = readProject(fixturePath);
      expect(meta.backgroundModes).toEqual([]);
    });
  });

  describe("frameworks detection", () => {
    it("extracts frameworks from pbxproj", () => {
      const meta = readProject(TEST_PROJECT);
      expect(meta.frameworks).toContain("UIKit");
      expect(meta.frameworks).toContain("AdSupport");
      expect(meta.frameworks).toContain("StoreKit");
    });
  });

  describe("source files", () => {
    it("finds Swift source files", () => {
      const meta = readProject(TEST_PROJECT);
      expect(meta.sourceFiles.length).toBeGreaterThan(0);
      expect(meta.sourceFiles.some((f) => f.endsWith(".swift"))).toBe(true);
    });
  });

  describe("xcodeproj detection", () => {
    it("finds .xcodeproj directory", () => {
      const meta = readProject(TEST_PROJECT);
      expect(meta.xcodeProjectPath).toBeTruthy();
      expect(meta.xcodeProjectPath!.endsWith(".xcodeproj")).toBe(true);
    });

    it("derives project name from xcodeproj", () => {
      const meta = readProject(TEST_PROJECT);
      expect(meta.projectName).toBe("TestApp");
    });
  });

  describe("error handling", () => {
    it("throws for non-existent project path", () => {
      expect(() => readProject("/nonexistent/path")).toThrow("does not exist");
    });

    it("handles missing files gracefully (no crash)", () => {
      // Create a temp dir with nothing in it
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shipagent-test-"));
      try {
        const meta = readProject(tmpDir);
        expect(meta.infoPlist).toBeNull();
        expect(meta.entitlements).toBeNull();
        expect(meta.privacyManifest).toBeNull();
        expect(meta.xcodeProjectPath).toBeNull();
        expect(meta.permissions).toEqual({});
        expect(meta.backgroundModes).toEqual([]);
        expect(meta.capabilities).toEqual([]);
        expect(meta.frameworks).toEqual([]);
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it("handles malformed plist gracefully", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shipagent-test-"));
      try {
        // Write a malformed Info.plist
        fs.writeFileSync(path.join(tmpDir, "Info.plist"), "NOT A VALID PLIST <>");
        const meta = readProject(tmpDir);
        // Should not crash — returns null for infoPlist
        expect(meta.infoPlist).toBeNull();
        expect(meta.permissions).toEqual({});
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
  });

  describe("IAP detection", () => {
    it("detects IAP from entitlements", () => {
      const fixturePath = path.resolve(__dirname, "../../test-fixtures/no-restore-purchases");
      const meta = readProject(fixturePath);
      expect(meta.hasIAP).toBe(true);
    });

    it("reports no IAP when entitlements lack it", () => {
      const fixturePath = path.resolve(__dirname, "../../test-fixtures/clean-project");
      const meta = readProject(fixturePath);
      expect(meta.hasIAP).toBe(false);
    });
  });
});
