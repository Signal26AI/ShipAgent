import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { readProject } from "../reader.js";

const FIXTURES = path.resolve(__dirname, "../../test-fixtures");

describe("fixture tests — reader data extraction", () => {
  describe("vague-location-string", () => {
    it("extracts vague NSLocationWhenInUseUsageDescription", () => {
      const meta = readProject(path.join(FIXTURES, "vague-location-string"));
      expect(meta.permissions).toHaveProperty("NSLocationWhenInUseUsageDescription");
      expect(meta.permissions.NSLocationWhenInUseUsageDescription).toBe("This app uses your location");
    });

    it("has correct bundle ID", () => {
      const meta = readProject(path.join(FIXTURES, "vague-location-string"));
      expect(meta.bundleId).toBe("com.example.vague-location");
    });
  });

  describe("missing-privacy-manifest", () => {
    it("returns privacyManifest: null", () => {
      const meta = readProject(path.join(FIXTURES, "missing-privacy-manifest"));
      expect(meta.privacyManifest).toBeNull();
      expect(meta.privacyManifestPath).toBeNull();
    });

    it("has no permissions", () => {
      const meta = readProject(path.join(FIXTURES, "missing-privacy-manifest"));
      expect(Object.keys(meta.permissions)).toEqual([]);
    });
  });

  describe("missing-att-with-adsupport", () => {
    it("detects AdSupport framework", () => {
      const meta = readProject(path.join(FIXTURES, "missing-att-with-adsupport"));
      expect(meta.frameworks).toContain("AdSupport");
    });

    it("has no NSUserTrackingUsageDescription", () => {
      const meta = readProject(path.join(FIXTURES, "missing-att-with-adsupport"));
      expect(meta.permissions).not.toHaveProperty("NSUserTrackingUsageDescription");
    });
  });

  describe("external-payment-link", () => {
    it("detects StoreKit framework", () => {
      const meta = readProject(path.join(FIXTURES, "external-payment-link"));
      expect(meta.frameworks).toContain("StoreKit");
    });

    it("finds source files with payment code", () => {
      const meta = readProject(path.join(FIXTURES, "external-payment-link"));
      expect(meta.sourceFiles.length).toBeGreaterThan(0);
      expect(meta.sourceFiles.some((f) => f.includes("UpgradeViewController"))).toBe(true);
    });
  });

  describe("placeholder-content", () => {
    it("extracts display name with TODO placeholder", () => {
      const meta = readProject(path.join(FIXTURES, "placeholder-content"));
      expect(meta.displayName).toContain("TODO");
    });
  });

  describe("competing-platform-ref", () => {
    it("extracts display name with Android reference", () => {
      const meta = readProject(path.join(FIXTURES, "competing-platform-ref"));
      expect(meta.displayName).toContain("Android");
    });
  });

  describe("excessive-background-modes", () => {
    it("extracts all 6 background modes", () => {
      const meta = readProject(path.join(FIXTURES, "excessive-background-modes"));
      expect(meta.backgroundModes).toHaveLength(6);
      expect(meta.backgroundModes).toContain("audio");
      expect(meta.backgroundModes).toContain("location");
      expect(meta.backgroundModes).toContain("voip");
      expect(meta.backgroundModes).toContain("fetch");
      expect(meta.backgroundModes).toContain("remote-notification");
      expect(meta.backgroundModes).toContain("bluetooth-central");
    });
  });

  describe("missing-sign-in-apple", () => {
    it("detects GoogleSignIn framework", () => {
      const meta = readProject(path.join(FIXTURES, "missing-sign-in-apple"));
      expect(meta.frameworks).toContain("GoogleSignIn");
    });

    it("has no Apple Sign In entitlement", () => {
      const meta = readProject(path.join(FIXTURES, "missing-sign-in-apple"));
      expect(meta.capabilities).not.toContain("com.apple.developer.applesignin");
    });

    it("finds login source files", () => {
      const meta = readProject(path.join(FIXTURES, "missing-sign-in-apple"));
      expect(meta.sourceFiles.some((f) => f.includes("LoginViewController"))).toBe(true);
    });
  });

  describe("no-restore-purchases", () => {
    it("detects IAP capability", () => {
      const meta = readProject(path.join(FIXTURES, "no-restore-purchases"));
      expect(meta.hasIAP).toBe(true);
    });

    it("detects StoreKit framework", () => {
      const meta = readProject(path.join(FIXTURES, "no-restore-purchases"));
      expect(meta.frameworks).toContain("StoreKit");
    });
  });

  describe("clean-project", () => {
    it("extracts everything correctly", () => {
      const meta = readProject(path.join(FIXTURES, "clean-project"));
      expect(meta.bundleId).toBe("com.example.clean-app");
      expect(meta.displayName).toBe("Clean App");
      expect(meta.deploymentTarget).toBe("17.0");
      expect(meta.deviceFamily).toEqual(["iPhone", "iPad"]);
    });

    it("has privacy manifest", () => {
      const meta = readProject(path.join(FIXTURES, "clean-project"));
      expect(meta.privacyManifest).not.toBeNull();
    });

    it("has Apple Sign In entitlement", () => {
      const meta = readProject(path.join(FIXTURES, "clean-project"));
      expect(meta.capabilities).toContain("com.apple.developer.applesignin");
    });

    it("has no excessive background modes", () => {
      const meta = readProject(path.join(FIXTURES, "clean-project"));
      expect(meta.backgroundModes).toEqual([]);
    });

    it("has specific permission strings", () => {
      const meta = readProject(path.join(FIXTURES, "clean-project"));
      expect(meta.permissions.NSCameraUsageDescription).toContain("recipes");
      expect(meta.permissions.NSPhotoLibraryUsageDescription).toContain("recipe");
    });

    it("no IAP", () => {
      const meta = readProject(path.join(FIXTURES, "clean-project"));
      expect(meta.hasIAP).toBe(false);
    });
  });
});
