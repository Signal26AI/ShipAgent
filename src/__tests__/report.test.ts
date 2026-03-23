import { describe, it, expect } from "vitest";
import { formatReport, parseAgentFindings, type Finding, type ReviewReport } from "../report.js";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    guideline: "2.1",
    title: "Test Finding",
    severity: "medium",
    confidence: 70,
    issue: "Something is wrong",
    fix: "Fix it",
    ...overrides,
  };
}

function makeReport(findings: Finding[], projectName = "TestApp"): ReviewReport {
  return {
    projectName,
    findings,
    summary: "Test summary",
    timestamp: "2026-03-23T00:00:00.000Z",
  };
}

describe("report — formatReport", () => {
  it("formats HIGH risk findings with 🔴", () => {
    const report = makeReport([
      makeFinding({ severity: "high", confidence: 90, title: "High Risk Issue" }),
    ]);
    const output = formatReport(report);
    expect(output).toContain("🔴");
    expect(output).toContain("High Risk Issue");
  });

  it("formats MEDIUM risk findings with 🟡", () => {
    const report = makeReport([
      makeFinding({ severity: "medium", confidence: 60, title: "Medium Risk Issue" }),
    ]);
    const output = formatReport(report);
    expect(output).toContain("🟡");
    expect(output).toContain("Medium Risk Issue");
  });

  it("formats PASSED findings with 🟢", () => {
    const report = makeReport([
      makeFinding({ severity: "pass", confidence: 30, title: "Passed Check" }),
    ]);
    const output = formatReport(report);
    expect(output).toContain("🟢");
    expect(output).toContain("Passed Check");
  });

  it("treats low confidence as pass (🟢)", () => {
    const report = makeReport([
      makeFinding({ severity: "high", confidence: 20, title: "Low Confidence" }),
    ]);
    const output = formatReport(report);
    expect(output).toContain("🟢");
  });

  it("treats high confidence as high risk (🔴)", () => {
    const report = makeReport([
      makeFinding({ severity: "medium", confidence: 85, title: "High Confidence Medium" }),
    ]);
    const output = formatReport(report);
    expect(output).toContain("🔴");
  });

  it("sorts by severity (HIGH first)", () => {
    const report = makeReport([
      makeFinding({ severity: "pass", confidence: 30, title: "AAA-Pass" }),
      makeFinding({ severity: "high", confidence: 90, title: "BBB-High" }),
      makeFinding({ severity: "medium", confidence: 60, title: "CCC-Medium" }),
    ]);
    const output = formatReport(report);
    const highPos = output.indexOf("BBB-High");
    const medPos = output.indexOf("CCC-Medium");
    const passPos = output.indexOf("AAA-Pass");
    expect(highPos).toBeLessThan(medPos);
    expect(medPos).toBeLessThan(passPos);
  });

  it("includes fix suggestions", () => {
    const report = makeReport([
      makeFinding({ fix: "Replace placeholder text with real content." }),
    ]);
    const output = formatReport(report);
    expect(output).toContain("Replace placeholder text with real content.");
  });

  it("includes example when provided", () => {
    const report = makeReport([
      makeFinding({ example: "let text = \"Lorem ipsum\"" }),
    ]);
    const output = formatReport(report);
    expect(output).toContain("let text = \"Lorem ipsum\"");
  });

  it("shows all clear message when no significant findings", () => {
    const report = makeReport([
      makeFinding({ severity: "pass", confidence: 20 }),
    ]);
    const output = formatReport(report);
    expect(output).toContain("No significant rejection risks detected");
  });

  it("shows warning when high risk issues exist", () => {
    const report = makeReport([
      makeFinding({ severity: "high", confidence: 90 }),
    ]);
    const output = formatReport(report);
    expect(output).toContain("high-risk issue");
    expect(output).toContain("Fix these before submitting");
  });

  it("shows medium warning when only medium risks exist", () => {
    const report = makeReport([
      makeFinding({ severity: "medium", confidence: 60 }),
    ]);
    const output = formatReport(report);
    expect(output).toContain("medium-risk finding");
  });

  it("produces clean report with empty findings", () => {
    const report = makeReport([]);
    const output = formatReport(report);
    expect(output).toContain("ShipAgent");
    expect(output).toContain("No significant rejection risks detected");
  });

  it("includes project name and timestamp", () => {
    const report = makeReport([], "MyGreatApp");
    const output = formatReport(report);
    expect(output).toContain("MyGreatApp");
    expect(output).toContain("2026-03-23");
  });
});

describe("report — parseAgentFindings", () => {
  it("parses findings from JSON code block", () => {
    const input = "Here are the findings:\n```json\n[{\"guideline\":\"2.1\",\"title\":\"Test\",\"severity\":\"high\",\"confidence\":90,\"issue\":\"Bad\",\"fix\":\"Fix\"}]\n```";
    const findings = parseAgentFindings(input);
    expect(findings).toHaveLength(1);
    expect(findings[0].guideline).toBe("2.1");
  });

  it("parses findings from direct JSON array", () => {
    const input = '[{"guideline":"5.1.1","title":"Privacy","severity":"medium","confidence":70,"issue":"Issue","fix":"Fix"}]';
    const findings = parseAgentFindings(input);
    expect(findings).toHaveLength(1);
  });

  it("parses findings from object with findings key", () => {
    const input = '{"findings":[{"guideline":"3.1.1","title":"IAP","severity":"high","confidence":85,"issue":"No IAP","fix":"Add IAP"}]}';
    const findings = parseAgentFindings(input);
    expect(findings).toHaveLength(1);
  });

  it("returns empty array for unparseable input", () => {
    const findings = parseAgentFindings("No JSON here, just text.");
    expect(findings).toEqual([]);
  });

  it("extracts JSON array embedded in text", () => {
    const input = 'Some text before [{"guideline":"2.1","title":"T","severity":"low","confidence":40,"issue":"I","fix":"F"}] and after';
    const findings = parseAgentFindings(input);
    expect(findings).toHaveLength(1);
  });
});
