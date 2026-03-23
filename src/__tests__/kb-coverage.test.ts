import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REJECTION_CASES_PATH = "/root/.openclaw/workspace-clio/Projects/ShipAgent/tests/rejection-cases.json";
const KB_DIR = path.resolve(__dirname, "../kb");

interface RejectionCase {
  id: string;
  title: string;
  rejection_guideline: string;
  [key: string]: unknown;
}

interface Pattern {
  id: string;
  guideline: string;
  [key: string]: unknown;
}

describe("KB coverage against 53 real-world rejection cases", () => {
  const rejectionCases: RejectionCase[] = JSON.parse(
    fs.readFileSync(REJECTION_CASES_PATH, "utf-8"),
  );
  const patternsData = JSON.parse(
    fs.readFileSync(path.join(KB_DIR, "patterns.json"), "utf-8"),
  );
  const patterns: Pattern[] = patternsData.patterns;

  // Build a set of guidelines the KB covers (including parent forms)
  const kbGuidelines = new Set<string>();
  for (const p of patterns) {
    kbGuidelines.add(p.guideline);
    // Add parent form: "5.1.2(i)" -> "5.1.2"
    const parent = p.guideline.replace(/\(.*\)$/, "");
    if (parent !== p.guideline) kbGuidelines.add(parent);
  }

  it("has 53 rejection test cases", () => {
    expect(rejectionCases).toHaveLength(53);
  });

  it("reports KB coverage for each rejection guideline", () => {
    const covered: string[] = [];
    const uncovered: string[] = [];

    // Get unique rejection guidelines
    const uniqueGuidelines = new Map<string, string[]>();
    for (const c of rejectionCases) {
      const g = c.rejection_guideline;
      if (!uniqueGuidelines.has(g)) uniqueGuidelines.set(g, []);
      uniqueGuidelines.get(g)!.push(c.id);
    }

    for (const [guideline, caseIds] of uniqueGuidelines) {
      // Check if KB covers this guideline (exact, parent, or parent match)
      const parentGuideline = guideline.replace(/\(.*\)$/, "");
      if (kbGuidelines.has(guideline) || kbGuidelines.has(parentGuideline)) {
        covered.push(guideline);
      } else {
        uncovered.push(guideline);
      }
    }

    // Calculate case-level coverage
    let coveredCases = 0;
    for (const c of rejectionCases) {
      const g = c.rejection_guideline;
      const parent = g.replace(/\(.*\)$/, "");
      if (kbGuidelines.has(g) || kbGuidelines.has(parent)) coveredCases++;
    }

    console.log(`\n📊 KB Coverage Report:`);
    console.log(`   KB covers ${coveredCases}/${rejectionCases.length} rejection cases`);
    console.log(`   Unique guidelines covered: ${covered.length}/${uniqueGuidelines.size}`);
    console.log(`   Covered guidelines: ${covered.sort().join(", ")}`);
    if (uncovered.length > 0) {
      console.log(`   ❌ Uncovered guidelines: ${uncovered.sort().join(", ")}`);
      for (const g of uncovered) {
        const cases = uniqueGuidelines.get(g)!;
        const titles = cases.map((id) => rejectionCases.find((c) => c.id === id)?.title);
        console.log(`      ${g}: ${titles.join(", ")}`);
      }
    }

    // The KB should cover at least 50% of rejection guidelines
    expect(coveredCases).toBeGreaterThan(rejectionCases.length * 0.5);
  });

  it("maps each rejection case to specific KB patterns", () => {
    const mapping: { caseId: string; guideline: string; kbPatterns: string[] }[] = [];

    for (const c of rejectionCases) {
      const g = c.rejection_guideline;
      const parent = g.replace(/\(.*\)$/, "");
      const matchingPatterns = patterns.filter(
        (p) => p.guideline === g || p.guideline === parent || p.guideline.startsWith(g),
      );
      mapping.push({
        caseId: c.id,
        guideline: g,
        kbPatterns: matchingPatterns.map((p) => p.id),
      });
    }

    // At least some cases should have pattern matches
    const casesWithMatches = mapping.filter((m) => m.kbPatterns.length > 0);
    expect(casesWithMatches.length).toBeGreaterThan(0);

    // Log the full mapping for visibility
    console.log(`\n📋 Case-to-Pattern Mapping:`);
    for (const m of mapping) {
      const status = m.kbPatterns.length > 0 ? "✅" : "❌";
      console.log(`   ${status} ${m.caseId} (${m.guideline}): ${m.kbPatterns.join(", ") || "no match"}`);
    }
  });
});
