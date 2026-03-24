#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import * as path from "node:path";
import * as fs from "node:fs";
import { runReview } from "./agent.js";
import { runFix } from "./fix.js";
import { formatReport } from "./report.js";
import { saveReview, loadLastReview, saveFixHistory } from "./state.js";
import { ship } from "./ship.js";
import type { ReviewReport } from "./report.js";
import type { FixHistory } from "./state.js";

const program = new Command();

program
  .name("shipagent")
  .description("AI-powered App Store review agent — catch rejection risks before you submit")
  .version("0.1.0");

program
  .command("review")
  .description("Review an iOS project for App Store rejection risks")
  .argument("[path]", "Path to the iOS project directory", ".")
  .option("--json", "Output raw JSON findings instead of formatted report")
  .action(async (projectPath: string, options: { json?: boolean }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.red("\n✖ ANTHROPIC_API_KEY environment variable is required."));
      console.error(chalk.dim("  Set it with: export ANTHROPIC_API_KEY=sk-ant-..."));
      process.exit(1);
    }

    const resolvedPath = path.resolve(projectPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(chalk.red(`\n✖ Project path does not exist: ${resolvedPath}`));
      process.exit(1);
    }

    const projectName = path.basename(resolvedPath);

    console.log("");
    console.log(chalk.bold.cyan("⚓ ShipAgent") + chalk.dim(" — App Store Review Agent"));
    console.log("");

    // Run agent review (ShipLint scan happens inside the agent)
    const reviewSpinner = ora("Running AI review agent (this may take 1-2 minutes)...").start();
    let findings;
    try {
      findings = await runReview(resolvedPath, apiKey);
      reviewSpinner.succeed(`Analysis complete — ${findings.length} findings`);
    } catch (e) {
      reviewSpinner.fail(`Review failed: ${(e as Error).message}`);
      if (process.env.DEBUG) {
        console.error(e);
      }
      process.exit(1);
    }

    // Save review state
    saveReview(resolvedPath, findings);

    // Format and display report
    if (options.json) {
      console.log(JSON.stringify(findings, null, 2));
    } else {
      const report: ReviewReport = {
        projectName,
        findings,
        summary: "",
        timestamp: new Date().toISOString(),
      };
      console.log(formatReport(report));
    }

    console.log(chalk.dim(`\nReview saved to ${resolvedPath}/.shipagent/last-review.json`));
  });

program
  .command("fix")
  .description("Fix flagged issues from the last review")
  .argument("[path]", "Path to the iOS project directory", ".")
  .action(async (projectPath: string) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.red("\n✖ ANTHROPIC_API_KEY environment variable is required."));
      process.exit(1);
    }

    const resolvedPath = path.resolve(projectPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(chalk.red(`\n✖ Project path does not exist: ${resolvedPath}`));
      process.exit(1);
    }

    // Load last review
    const lastReview = loadLastReview(resolvedPath);
    if (!lastReview) {
      console.error(chalk.red("\n✖ No previous review found. Run 'shipagent review' first."));
      process.exit(1);
    }

    const actionable = lastReview.findings.filter(
      (f) => (f.severity === "high" || f.severity === "medium") && f.confidence >= 40,
    );

    if (actionable.length === 0) {
      console.log(chalk.green("\n✅ No actionable issues to fix!\n"));
      process.exit(0);
    }

    const projectName = path.basename(resolvedPath);

    console.log("");
    console.log(chalk.bold.cyan("⚓ ShipAgent") + chalk.bold.white(" — Fix Mode"));
    console.log(chalk.dim(`  Fixing ${actionable.length} issue(s) from review at ${lastReview.timestamp}`));
    console.log("");

    const fixSpinner = ora("Applying fixes...").start();
    try {
      const fixResult = await runFix(resolvedPath, actionable, apiKey);
      fixSpinner.succeed(`Applied ${fixResult.fixes.length} fix(es), skipped ${fixResult.skipped.length}`);

      // Display results
      if (fixResult.fixes.length > 0) {
        console.log(chalk.bold("\nFixes applied:"));
        for (const fix of fixResult.fixes) {
          console.log(`  ${chalk.green("✓")} ${chalk.dim(`[${fix.guideline}]`)} ${fix.change} ${chalk.dim(`(${fix.file})`)}`);
        }
      }
      if (fixResult.skipped.length > 0) {
        console.log(chalk.bold("\nSkipped:"));
        for (const skip of fixResult.skipped) {
          console.log(`  ${chalk.yellow("⊘")} ${chalk.dim(`[${skip.guideline}]`)} ${skip.reason}`);
        }
      }

      // Save fix history
      const fixHistory: FixHistory = {
        fixes: fixResult.fixes.map((f) => ({ ...f, timestamp: new Date().toISOString() })),
        skipped: fixResult.skipped,
        timestamp: new Date().toISOString(),
      };
      saveFixHistory(resolvedPath, fixHistory);

      console.log(chalk.dim(`\nFix history saved. Run 'shipagent review' to verify fixes.\n`));
    } catch (e) {
      fixSpinner.fail(`Fix failed: ${(e as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("ship")
  .description("Full ship loop: review → fix → re-review → submit")
  .argument("[path]", "Path to the iOS project directory", ".")
  .action(async (projectPath: string) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.red("\n✖ ANTHROPIC_API_KEY environment variable is required."));
      process.exit(1);
    }

    const resolvedPath = path.resolve(projectPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(chalk.red(`\n✖ Project path does not exist: ${resolvedPath}`));
      process.exit(1);
    }

    await ship(resolvedPath, apiKey);
  });

program.parse();
