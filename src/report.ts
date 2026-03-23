import chalk from "chalk";

export interface Finding {
  guideline: string;
  title: string;
  severity: "high" | "medium" | "low" | "pass";
  confidence: number; // 0-100
  issue: string;
  fix: string;
  example?: string;
}

export interface ReviewReport {
  projectName: string;
  findings: Finding[];
  summary: string;
  timestamp: string;
}

function riskIcon(severity: string, confidence: number): string {
  if (severity === "pass" || confidence < 40) return "🟢";
  if (severity === "high" || confidence >= 80) return "🔴";
  return "🟡";
}

function riskLabel(severity: string, confidence: number): string {
  if (severity === "pass" || confidence < 40) return chalk.green("PASSED");
  if (severity === "high" || confidence >= 80) return chalk.red("HIGH RISK");
  return chalk.yellow("MEDIUM RISK");
}

export function formatReport(report: ReviewReport): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold.cyan("╔══════════════════════════════════════════════════════════╗"));
  lines.push(chalk.bold.cyan("║") + chalk.bold.white("  ⚓ ShipAgent — App Store Review Report                  ") + chalk.bold.cyan("║"));
  lines.push(chalk.bold.cyan("╚══════════════════════════════════════════════════════════╝"));
  lines.push("");
  lines.push(chalk.dim(`Project: ${report.projectName}`));
  lines.push(chalk.dim(`Date: ${report.timestamp}`));
  lines.push("");

  // Sort: high first, then medium, then pass
  const sorted = [...report.findings].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2, pass: 3 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  const highCount = sorted.filter((f) => f.severity === "high" || f.confidence >= 80).length;
  const mediumCount = sorted.filter((f) => f.severity === "medium" && f.confidence >= 40 && f.confidence < 80).length;
  const passCount = sorted.filter((f) => f.severity === "pass" || f.confidence < 40).length;

  lines.push(chalk.bold("Summary"));
  lines.push(`  🔴 ${highCount} High Risk    🟡 ${mediumCount} Medium Risk    🟢 ${passCount} Passed`);
  lines.push("");
  lines.push(chalk.dim("─".repeat(60)));
  lines.push("");

  for (const finding of sorted) {
    const icon = riskIcon(finding.severity, finding.confidence);
    const label = riskLabel(finding.severity, finding.confidence);

    lines.push(`${icon} ${label} — ${chalk.bold(finding.title)}`);
    lines.push(`   ${chalk.dim(`Guideline ${finding.guideline}`)} · ${chalk.dim(`Confidence: ${finding.confidence}%`)}`);
    lines.push(`   ${finding.issue}`);
    lines.push(`   ${chalk.green("Fix:")} ${finding.fix}`);
    if (finding.example) {
      lines.push(`   ${chalk.dim("Example:")} ${finding.example}`);
    }
    lines.push("");
  }

  lines.push(chalk.dim("─".repeat(60)));
  lines.push("");

  if (highCount > 0) {
    lines.push(chalk.red.bold(`⚠️  ${highCount} high-risk issue(s) found. Fix these before submitting.`));
  } else if (mediumCount > 0) {
    lines.push(chalk.yellow.bold(`⚡ No high-risk issues, but ${mediumCount} medium-risk finding(s) to review.`));
  } else {
    lines.push(chalk.green.bold("✅ Looking good! No significant rejection risks detected."));
  }

  lines.push("");
  return lines.join("\n");
}

export function parseAgentFindings(agentOutput: string): Finding[] {
  // Try to parse JSON from agent output
  const jsonMatch = agentOutput.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed)) return parsed as Finding[];
      if (parsed.findings && Array.isArray(parsed.findings)) return parsed.findings as Finding[];
    } catch {
      // fall through
    }
  }

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(agentOutput);
    if (Array.isArray(parsed)) return parsed as Finding[];
    if (parsed.findings && Array.isArray(parsed.findings)) return parsed.findings as Finding[];
  } catch {
    // fall through
  }

  // Try to find JSON array anywhere in the output
  const arrayMatch = agentOutput.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]) as Finding[];
    } catch {
      // fall through
    }
  }

  return [];
}
