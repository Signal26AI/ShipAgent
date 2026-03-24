import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import type { Finding } from "./report.js";

// Load KB data
const kbDir = path.join(import.meta.dirname, "kb");
const guidelines = JSON.parse(fs.readFileSync(path.join(kbDir, "guidelines.json"), "utf-8"));
const patterns = JSON.parse(fs.readFileSync(path.join(kbDir, "patterns.json"), "utf-8"));

/**
 * Run ShipLint scan on a project path. Returns structured JSON output or an error message.
 */
export function runShiplintScan(projectPath: string): { ok: true; output: string } | { ok: false; error: string } {
  try {
    const result = execSync(`npx shiplint scan -f json "${projectPath}" 2>&1`, {
      timeout: 60000,
      encoding: "utf-8",
    });
    return { ok: true, output: result };
  } catch (e) {
    const msg = (e as Error).message || "";
    if (msg.includes("not found") || msg.includes("ERR_MODULE_NOT_FOUND") || msg.includes("command not found")) {
      return { ok: false, error: "ShipLint not found. Install with: npm install -g shiplint" };
    }
    // ShipLint ran but exited non-zero (e.g., findings found) — still has output
    const stderr = (e as { stdout?: string }).stdout;
    if (stderr) {
      return { ok: true, output: stderr };
    }
    return { ok: false, error: `ShipLint scan failed: ${msg}` };
  }
}

// --- Tool definitions for the Anthropic API ---

const reviewTools: Anthropic.Tool[] = [
  {
    name: "run_shiplint",
    description:
      "Run ShipLint automated scanner on the project. Returns structured JSON with Info.plist data, permissions, entitlements, privacy manifest, and static rule check results.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "read_project_file",
    description:
      "Read the contents of a file from the iOS project being reviewed. Use relative paths from the project root.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file relative to the project root",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "query_kb",
    description:
      "Query the rejection knowledge base for known patterns. Search by guideline ID (e.g. '5.1.1') or keyword.",
    input_schema: {
      type: "object" as const,
      properties: {
        guideline_id: {
          type: "string",
          description: "Guideline ID to look up (e.g. '2.1', '5.1.1')",
        },
        keyword: {
          type: "string",
          description: "Keyword to search patterns (e.g. 'privacy', 'payment')",
        },
      },
      required: [],
    },
  },
];

// --- Tool execution ---

function executeRunShiplint(projectPath: string): string {
  const result = runShiplintScan(projectPath);
  if (result.ok) return result.output;
  return `${result.error}\n\nShipLint is not available. Use read_project_file to manually inspect project files instead.`;
}

function executeReadProjectFile(projectPath: string, args: { file_path: string }): string {
  const fullPath = path.resolve(projectPath, args.file_path);
  if (!fullPath.startsWith(projectPath)) {
    return "Error: Path is outside the project directory";
  }
  try {
    const content = fs.readFileSync(fullPath, "utf-8");
    return content.length > 50000 ? content.slice(0, 50000) + "\n[...truncated]" : content;
  } catch (e) {
    return `Error reading file: ${(e as Error).message}`;
  }
}

function executeQueryKb(args: { guideline_id?: string; keyword?: string }): string {
  let results: unknown[] = [];

  if (args.guideline_id) {
    const gid = args.guideline_id;
    const matchingGuidelines = guidelines.guidelines.filter(
      (g: { id: string }) => g.id === gid || g.id.startsWith(gid),
    );
    const matchingPatterns = patterns.patterns.filter(
      (p: { guideline: string }) => p.guideline === gid || p.guideline.startsWith(gid),
    );
    results = [
      ...matchingGuidelines.map((g: unknown) => ({ type: "guideline", ...(g as object) })),
      ...matchingPatterns.map((p: unknown) => ({ type: "pattern", ...(p as object) })),
    ];
  }

  if (args.keyword) {
    const kw = args.keyword.toLowerCase();
    const kwGuidelines = guidelines.guidelines.filter(
      (g: { title: string; text: string; category: string }) =>
        g.title.toLowerCase().includes(kw) ||
        g.text.toLowerCase().includes(kw) ||
        g.category.toLowerCase().includes(kw),
    );
    const kwPatterns = patterns.patterns.filter(
      (p: { title: string; description: string }) =>
        p.title.toLowerCase().includes(kw) || p.description.toLowerCase().includes(kw),
    );
    results = [
      ...results,
      ...kwGuidelines.map((g: unknown) => ({ type: "guideline", ...(g as object) })),
      ...kwPatterns.map((p: unknown) => ({ type: "pattern", ...(p as object) })),
    ];
  }

  if (results.length === 0) return "No matching guidelines or patterns found.";
  return JSON.stringify(results, null, 2);
}

function executeReviewTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  projectPath: string,
): string {
  switch (toolName) {
    case "run_shiplint":
      return executeRunShiplint(projectPath);
    case "read_project_file":
      return executeReadProjectFile(projectPath, toolInput as { file_path: string });
    case "query_kb":
      return executeQueryKb(toolInput as { guideline_id?: string; keyword?: string });
    default:
      return `Unknown tool: ${toolName}`;
  }
}

// --- System prompt ---

function buildSystemPrompt(): string {
  return `You are ShipAgent, an expert iOS App Store review analyzer.

Your goal: Identify App Store rejection risks in this iOS project before submission.

## Process
1. First run ShipLint to get a structured scan of the project — this handles Info.plist parsing, permissions, entitlements, privacy manifest, and static rule checks
2. Review ShipLint's findings carefully
3. Use read_project_file for deeper analysis (app description, source code for subjective checks like 4.3 spam assessment)
4. Use query_kb to look up known rejection patterns by guideline ID
5. Cross-reference your findings against Apple's App Store Review Guidelines
6. Return your findings as a structured JSON report

## Scoring Guidelines
- 🔴 HIGH RISK (severity "high", confidence 80-100%): Pattern clearly matches a known rejection case
- 🟡 MEDIUM RISK (severity "medium", confidence 40-79%): Potential issue, similar to rejection patterns
- 🟢 PASSED (severity "pass", confidence 0-39%): No issues detected

## What to Check (systematic walkthrough)
1. **Privacy & Data** (5.1.x): Privacy policy, privacy manifest, permission strings, tracking, data collection
2. **App Completeness** (2.1): Placeholder content, crashes, broken links, missing resources
3. **Metadata** (2.3.x): Accuracy, platform references, misleading content
4. **Payments** (3.1.x): IAP usage, restore purchases, subscription disclosures
5. **Authentication** (5.3.4): Sign in with Apple requirement
6. **Design** (4.x): Minimum functionality, iPad support, HIG compliance
7. **Background Modes** (2.5.4): Justified background mode usage
8. **Content** (1.2): UGC moderation if applicable
9. **Legal** (5.2.x): Copyright/trademark issues

## Output Format
After completing your analysis, output ONLY a JSON code block with your findings:
\`\`\`json
{
  "findings": [
    {
      "guideline": "5.1.1",
      "title": "Missing Privacy Manifest",
      "severity": "high",
      "confidence": 90,
      "issue": "Description of the issue found",
      "fix": "Specific actionable fix"
    }
  ]
}
\`\`\`

Be thorough. Check EVERY relevant guideline. If something looks fine, include it as a "pass" finding.
Do NOT make up issues — only flag things you can verify from the project files.`;
}

// --- Agent loop ---

async function runAgentLoop(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  tools: Anthropic.Tool[],
  projectPath: string,
  maxTurns: number,
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    // If no tool use, extract final text and return
    if (response.stop_reason === "end_turn") {
      let text = "";
      for (const block of response.content) {
        if (block.type === "text") text += block.text;
      }
      return text;
    }

    // Handle tool calls
    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = executeReviewTool(block.name, block.input as Record<string, unknown>, projectPath);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }
  }

  // If we exhausted turns, grab what we have from the last assistant message
  return "";
}

// --- Public API ---

export async function runReview(projectPath: string, apiKey: string): Promise<Finding[]> {
  const absPath = path.resolve(projectPath);
  const client = new Anthropic({ apiKey });

  const prompt = `Review this iOS project for App Store rejection risks.

Project path: ${absPath}

## Instructions
1. **Start by running ShipLint** to get a structured scan of the project (permissions, entitlements, privacy manifest, etc.)
2. Review ShipLint's findings — these cover static checks automatically
3. Query the knowledge base for the most common rejection categories
4. Use read_project_file for deeper analysis of specific files (source code for subjective checks, payment flows, authentication, etc.)
5. Systematically check each guideline category
6. Return your findings as JSON

Begin your analysis by running ShipLint first.`;

  const lastText = await runAgentLoop(client, buildSystemPrompt(), prompt, reviewTools, absPath, 15);

  const { parseAgentFindings } = await import("./report.js");
  return parseAgentFindings(lastText);
}

export async function runTargetedReview(
  projectPath: string,
  flaggedGuidelines: string[],
  apiKey: string,
): Promise<Finding[]> {
  const absPath = path.resolve(projectPath);
  const client = new Anthropic({ apiKey });
  const guidelineList = flaggedGuidelines.join(", ");

  const targetedSystemPrompt = `You are ShipAgent, an expert iOS App Store review analyzer.

You are performing a TARGETED re-review. Only check the following specific guidelines: ${guidelineList}

Do NOT perform a full scan. Only verify whether the previously flagged issues have been fixed.

## Process
1. Run ShipLint to scan the project for current state
2. Use read_project_file if you need to inspect specific files
3. Check only the listed guidelines

## Scoring Guidelines
- 🔴 HIGH RISK (severity "high", confidence 80-100%): Pattern clearly matches a known rejection case
- 🟡 MEDIUM RISK (severity "medium", confidence 40-79%): Potential issue, similar to rejection patterns
- 🟢 PASSED (severity "pass", confidence 0-39%): Issue has been fixed or no longer present

## Output Format
After checking each flagged guideline, output ONLY a JSON code block:
\`\`\`json
{
  "findings": [
    {
      "guideline": "5.1.1",
      "title": "Missing Privacy Manifest",
      "severity": "pass",
      "confidence": 10,
      "issue": "Privacy manifest is now present",
      "fix": "No action needed"
    }
  ]
}
\`\`\`

Only include findings for the guidelines listed above. Be precise — check if the specific issues were actually resolved.`;

  const prompt = `Perform a TARGETED re-review of this iOS project at: ${absPath}
Only check these guidelines: ${guidelineList}

Start by running ShipLint to get the current project state, then verify whether previous issues have been fixed.`;

  const lastText = await runAgentLoop(client, targetedSystemPrompt, prompt, reviewTools, absPath, 10);

  const { parseAgentFindings } = await import("./report.js");
  return parseAgentFindings(lastText);
}
