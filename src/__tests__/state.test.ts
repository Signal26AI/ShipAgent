import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { saveReview, loadLastReview, saveFixHistory, loadFixHistory, type FixHistory } from "../state.js";
import type { Finding } from "../report.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shipagent-state-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("state — review persistence", () => {
  it("saves review state to .shipagent/last-review.json", () => {
    const findings: Finding[] = [
      {
        guideline: "2.1",
        title: "Placeholder",
        severity: "high",
        confidence: 90,
        issue: "Lorem ipsum found",
        fix: "Replace with real content",
      },
    ];
    saveReview(tmpDir, findings);
    const filePath = path.join(tmpDir, ".shipagent", "last-review.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(data.findings).toHaveLength(1);
    expect(data.findings[0].guideline).toBe("2.1");
    expect(data.timestamp).toBeTruthy();
  });

  it("loads previous review state", () => {
    const findings: Finding[] = [
      {
        guideline: "5.1.1",
        title: "Privacy",
        severity: "medium",
        confidence: 65,
        issue: "Vague permission",
        fix: "Be specific",
      },
    ];
    saveReview(tmpDir, findings);
    const loaded = loadLastReview(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.findings).toHaveLength(1);
    expect(loaded!.findings[0].title).toBe("Privacy");
    expect(loaded!.timestamp).toBeTruthy();
  });

  it("returns null when no previous review exists", () => {
    const loaded = loadLastReview(tmpDir);
    expect(loaded).toBeNull();
  });

  it("creates .shipagent/ directory if missing", () => {
    const stateDir = path.join(tmpDir, ".shipagent");
    expect(fs.existsSync(stateDir)).toBe(false);
    saveReview(tmpDir, []);
    expect(fs.existsSync(stateDir)).toBe(true);
  });
});

describe("state — fix history", () => {
  it("saves fix history", () => {
    const history: FixHistory = {
      fixes: [
        {
          file: "Info.plist",
          change: "Updated permission string",
          guideline: "5.1.1",
          timestamp: "2026-03-23T00:00:00.000Z",
        },
      ],
      skipped: [
        {
          guideline: "4.3",
          reason: "Manual review needed",
        },
      ],
      timestamp: "2026-03-23T00:00:00.000Z",
    };
    saveFixHistory(tmpDir, history);
    const filePath = path.join(tmpDir, ".shipagent", "fix-history.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const loaded = loadFixHistory(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.fixes).toHaveLength(1);
    expect(loaded!.skipped).toHaveLength(1);
  });

  it("returns null when no fix history exists", () => {
    expect(loadFixHistory(tmpDir)).toBeNull();
  });
});

describe("state — .gitignore management", () => {
  it("adds .shipagent/ to .gitignore", () => {
    // Create a .gitignore first
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/\n");
    saveReview(tmpDir, []);
    const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(gitignore).toContain(".shipagent/");
  });

  it("does not duplicate .shipagent/ in .gitignore", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), ".shipagent/\nnode_modules/\n");
    saveReview(tmpDir, []);
    const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    const count = (gitignore.match(/\.shipagent\//g) || []).length;
    expect(count).toBe(1);
  });

  it("works when no .gitignore exists", () => {
    // Should not crash
    saveReview(tmpDir, []);
    expect(fs.existsSync(path.join(tmpDir, ".shipagent", "last-review.json"))).toBe(true);
    // .gitignore should not have been created
    expect(fs.existsSync(path.join(tmpDir, ".gitignore"))).toBe(false);
  });
});
