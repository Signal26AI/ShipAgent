#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import * as path from "node:path";
import * as fs from "node:fs";
import { readProject } from "./reader.js";
import { runReview } from "./agent.js";
import { formatReport } from "./report.js";
import type { ReviewReport } from "./report.js";

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

    console.log("");
    console.log(chalk.bold.cyan("⚓ ShipAgent") + chalk.dim(" — App Store Review Agent"));
    console.log("");

    // Step 1: Read project
    const readSpinner = ora("Reading project files...").start();
    let metadata;
    try {
      metadata = readProject(resolvedPath);
      readSpinner.succeed(
        `Found project: ${chalk.bold(metadata.projectName)}` +
          (metadata.bundleId ? ` (${metadata.bundleId})` : "") +
          ` — ${metadata.sourceFiles.length} source files`,
      );
    } catch (e) {
      readSpinner.fail(`Failed to read project: ${(e as Error).message}`);
      process.exit(1);
    }

    // Step 2: Run agent review
    const reviewSpinner = ora("Running AI review agent (this may take 1-2 minutes)...").start();
    let findings;
    try {
      findings = await runReview(metadata, apiKey);
      reviewSpinner.succeed(`Analysis complete — ${findings.length} findings`);
    } catch (e) {
      reviewSpinner.fail(`Review failed: ${(e as Error).message}`);
      if (process.env.DEBUG) {
        console.error(e);
      }
      process.exit(1);
    }

    // Step 3: Format and display report
    if (options.json) {
      console.log(JSON.stringify(findings, null, 2));
    } else {
      const report: ReviewReport = {
        projectName: metadata.projectName,
        findings,
        summary: "",
        timestamp: new Date().toISOString(),
      };
      console.log(formatReport(report));
    }
  });

program.parse();
