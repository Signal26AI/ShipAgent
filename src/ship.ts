import * as readline from "node:readline/promises";
import chalk from "chalk";
import ora from "ora";
import { readProject } from "./reader.js";
import { runReview, runTargetedReview } from "./agent.js";
import { runFix } from "./fix.js";
import { formatReport } from "./report.js";
import { saveReview, saveFixHistory } from "./state.js";
import type { Finding, ReviewReport } from "./report.js";
import type { FixHistory } from "./state.js";

const MAX_ITERATIONS = 3;

function getActionableFindings(findings: Finding[]): Finding[] {
  return findings.filter(
    (f) =>
      (f.severity === "high" || f.severity === "medium") && f.confidence >= 40,
  );
}

function getUniqueGuidelines(findings: Finding[]): string[] {
  return [...new Set(findings.map((f) => f.guideline))];
}

async function promptUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(question);
    return answer.trim().toLowerCase() !== "n";
  } finally {
    rl.close();
  }
}

function displayReport(
  projectName: string,
  findings: Finding[],
  iteration?: number,
): void {
  const report: ReviewReport = {
    projectName,
    findings,
    summary: "",
    timestamp: new Date().toISOString(),
  };
  if (iteration !== undefined) {
    console.log(
      chalk.dim(`\n── Iteration ${iteration} ──────────────────────────────`),
    );
  }
  console.log(formatReport(report));
}

export async function ship(
  projectPath: string,
  apiKey: string,
): Promise<void> {
  const resolvedPath = (await import("node:path")).resolve(projectPath);

  console.log("");
  console.log(
    chalk.bold.cyan("⚓ ShipAgent") +
      chalk.bold.white(" — Ship Loop") +
      chalk.dim(" (review → fix → re-review → submit)"),
  );
  console.log("");

  // Step 1: Read project
  const readSpinner = ora("Reading project files...").start();
  let metadata;
  try {
    metadata = readProject(resolvedPath);
    readSpinner.succeed(
      `Found project: ${chalk.bold(metadata.projectName)} — ${metadata.sourceFiles.length} source files`,
    );
  } catch (e) {
    readSpinner.fail(`Failed to read project: ${(e as Error).message}`);
    process.exit(1);
  }

  // Step 2: Full review
  const reviewSpinner = ora(
    "Running AI review agent (this may take 1-2 minutes)...",
  ).start();
  let findings: Finding[];
  try {
    findings = await runReview(metadata, apiKey);
    reviewSpinner.succeed(`Analysis complete — ${findings.length} findings`);
  } catch (e) {
    reviewSpinner.fail(`Review failed: ${(e as Error).message}`);
    process.exit(1);
  }

  // Save initial review
  saveReview(resolvedPath, findings);

  let iteration = 1;

  while (iteration <= MAX_ITERATIONS) {
    // Display report
    displayReport(
      metadata.projectName,
      findings,
      iteration > 1 ? iteration : undefined,
    );

    // Check for actionable issues
    const actionable = getActionableFindings(findings);

    if (actionable.length === 0) {
      console.log(chalk.green.bold("\n✅ All clear! No actionable issues remaining.\n"));
      break;
    }

    console.log(
      chalk.yellow(
        `\n${actionable.length} actionable issue(s) found.`,
      ),
    );

    // Prompt user
    const shouldFix = await promptUser(
      chalk.bold(`Fix these issues? [Y/n] `),
    );

    if (!shouldFix) {
      console.log(chalk.dim("\nSkipping fixes. Review report saved."));
      break;
    }

    // Run fix agent
    const fixSpinner = ora("Applying fixes...").start();
    let fixResult;
    try {
      fixResult = await runFix(metadata, actionable, apiKey);
      fixSpinner.succeed(
        `Applied ${fixResult.fixes.length} fix(es), skipped ${fixResult.skipped.length}`,
      );
    } catch (e) {
      fixSpinner.fail(`Fix failed: ${(e as Error).message}`);
      break;
    }

    // Save fix history
    const fixHistory: FixHistory = {
      fixes: fixResult.fixes.map((f) => ({
        ...f,
        timestamp: new Date().toISOString(),
      })),
      skipped: fixResult.skipped,
      timestamp: new Date().toISOString(),
    };
    saveFixHistory(resolvedPath, fixHistory);

    // Display fix summary
    if (fixResult.fixes.length > 0) {
      console.log(chalk.bold("\nFixes applied:"));
      for (const fix of fixResult.fixes) {
        console.log(
          `  ${chalk.green("✓")} ${chalk.dim(`[${fix.guideline}]`)} ${fix.change} ${chalk.dim(`(${fix.file})`)}`,
        );
      }
    }
    if (fixResult.skipped.length > 0) {
      console.log(chalk.bold("\nSkipped:"));
      for (const skip of fixResult.skipped) {
        console.log(
          `  ${chalk.yellow("⊘")} ${chalk.dim(`[${skip.guideline}]`)} ${skip.reason}`,
        );
      }
    }

    // Re-review (targeted)
    const flaggedGuidelines = getUniqueGuidelines(actionable);
    const reReviewSpinner = ora(
      `Re-reviewing ${flaggedGuidelines.length} guideline(s)...`,
    ).start();

    // Re-read project metadata (files may have changed)
    metadata = readProject(resolvedPath);

    try {
      findings = await runTargetedReview(metadata, flaggedGuidelines, apiKey);
      reReviewSpinner.succeed(
        `Re-review complete — ${findings.length} findings`,
      );
    } catch (e) {
      reReviewSpinner.fail(`Re-review failed: ${(e as Error).message}`);
      break;
    }

    // Save updated review
    saveReview(resolvedPath, findings);

    iteration++;

    if (iteration > MAX_ITERATIONS) {
      console.log(
        chalk.yellow.bold(
          `\n⚠️  Max iterations (${MAX_ITERATIONS}) reached. Showing final report.`,
        ),
      );
      displayReport(metadata.projectName, findings);
    }
  }

  // Final: stub submit step
  console.log("");
  const actionableRemaining = getActionableFindings(findings);
  if (actionableRemaining.length === 0) {
    const shouldSubmit = await promptUser(
      chalk.bold("Submit via Fastlane? [Y/n] "),
    );
    if (shouldSubmit) {
      console.log(
        chalk.dim(
          "\n🚧 Fastlane integration coming soon! For now, submit manually.\n",
        ),
      );
    }
  } else {
    console.log(
      chalk.yellow(
        `${actionableRemaining.length} issue(s) remain. Fix them before submitting.\n`,
      ),
    );
  }
}
