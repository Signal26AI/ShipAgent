import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const KB_DIR = path.resolve(__dirname, "../kb");

interface Pattern {
  id: string;
  guideline: string;
  title: string;
  description: string;
  severity: string;
  detection: string[];
  fix: string;
  [key: string]: unknown;
}

interface Guideline {
  id: string;
  title: string;
  category: string;
  [key: string]: unknown;
}

let patterns: { patterns: Pattern[] };
let guidelines: { guidelines: Guideline[] };

describe("KB — JSON validity", () => {
  it("patterns.json is valid JSON", () => {
    const content = fs.readFileSync(path.join(KB_DIR, "patterns.json"), "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
    patterns = JSON.parse(content);
  });

  it("guidelines.json is valid JSON", () => {
    const content = fs.readFileSync(path.join(KB_DIR, "guidelines.json"), "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
    guidelines = JSON.parse(content);
  });
});

describe("KB — pattern schema validation", () => {
  // Load once at module level
  const rawPatterns = JSON.parse(
    fs.readFileSync(path.join(KB_DIR, "patterns.json"), "utf-8"),
  );
  const rawGuidelines = JSON.parse(
    fs.readFileSync(path.join(KB_DIR, "guidelines.json"), "utf-8"),
  );

  it("every pattern has required fields: id, guideline, description, severity, detection, fix", () => {
    for (const p of rawPatterns.patterns) {
      expect(p, `Pattern ${p.id || "unknown"} missing 'id'`).toHaveProperty("id");
      expect(p, `Pattern ${p.id} missing 'guideline'`).toHaveProperty("guideline");
      expect(p, `Pattern ${p.id} missing 'description'`).toHaveProperty("description");
      expect(p, `Pattern ${p.id} missing 'severity'`).toHaveProperty("severity");
      expect(p, `Pattern ${p.id} missing 'detection'`).toHaveProperty("detection");
      expect(p, `Pattern ${p.id} missing 'fix'`).toHaveProperty("fix");
      expect(Array.isArray(p.detection), `Pattern ${p.id} 'detection' should be an array`).toBe(true);
      expect(typeof p.fix, `Pattern ${p.id} 'fix' should be a string`).toBe("string");
    }
  });

  it("every guideline has required fields: id, title, category", () => {
    for (const g of rawGuidelines.guidelines) {
      expect(g, `Guideline missing 'id'`).toHaveProperty("id");
      expect(g, `Guideline ${g.id} missing 'title'`).toHaveProperty("title");
      expect(g, `Guideline ${g.id} missing 'category'`).toHaveProperty("category");
    }
  });

  it("no duplicate pattern IDs", () => {
    const ids = rawPatterns.patterns.map((p: Pattern) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size, `Found duplicate pattern IDs: ${ids.filter((id: string, i: number) => ids.indexOf(id) !== i)}`).toBe(ids.length);
  });

  it("no duplicate guideline IDs", () => {
    const ids = rawGuidelines.guidelines.map((g: Guideline) => g.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size, `Found duplicate guideline IDs: ${ids.filter((id: string, i: number) => ids.indexOf(id) !== i)}`).toBe(ids.length);
  });

  it("all patterns reference valid guideline IDs", () => {
    const guidelineIds = new Set(rawGuidelines.guidelines.map((g: Guideline) => g.id));
    const missing: string[] = [];
    for (const p of rawPatterns.patterns) {
      // Pattern guidelines may be sub-sections like "5.1.2(i)" — check both exact and parent
      const patternGuideline = p.guideline;
      const parentGuideline = patternGuideline.replace(/\(.*\)$/, "");
      if (!guidelineIds.has(patternGuideline) && !guidelineIds.has(parentGuideline)) {
        missing.push(`Pattern ${p.id} references guideline '${patternGuideline}' which is not in guidelines.json`);
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("patterns have valid severity values", () => {
    const validSeverities = ["high", "medium", "low", "critical"];
    for (const p of rawPatterns.patterns) {
      expect(validSeverities, `Pattern ${p.id} has invalid severity: ${p.severity}`).toContain(p.severity);
    }
  });
});
