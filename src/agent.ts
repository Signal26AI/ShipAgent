import * as fs from "node:fs";
import * as path from "node:path";
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";
import type { ProjectMetadata } from "./reader.js";
import type { Finding } from "./report.js";
import { formatMetadataForAgent } from "./reader.js";

// Load KB data
const kbDir = path.join(import.meta.dirname, "kb");
const guidelines = JSON.parse(fs.readFileSync(path.join(kbDir, "guidelines.json"), "utf-8"));
const patterns = JSON.parse(fs.readFileSync(path.join(kbDir, "patterns.json"), "utf-8"));

function buildSystemPrompt(): string {
  return `You are ShipAgent, an expert iOS App Store review analyzer.

Your goal: Identify App Store rejection risks in this iOS project before submission.

## Process
1. Examine the project metadata provided to you
2. Use the read_project_file tool to inspect specific source files for deeper analysis
3. Use the query_kb tool to look up known rejection patterns by guideline ID
4. Cross-reference your findings against Apple's App Store Review Guidelines
5. Return your findings as a structured JSON report

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

export async function runReview(
  metadata: ProjectMetadata,
  apiKey: string,
): Promise<Finding[]> {
  const projectInfo = formatMetadataForAgent(metadata);

  // Define MCP tools
  const readProjectFile = tool(
    "read_project_file",
    "Read the contents of a file from the iOS project being reviewed. Use relative paths from the project root.",
    { file_path: z.string().describe("Path to the file relative to the project root") },
    async (args) => {
      const fullPath = path.resolve(metadata.projectPath, args.file_path);
      // Security: ensure we stay within the project
      if (!fullPath.startsWith(metadata.projectPath)) {
        return { content: [{ type: "text" as const, text: "Error: Path is outside the project directory" }] };
      }
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        // Truncate very large files
        const truncated = content.length > 50000 ? content.slice(0, 50000) + "\n[...truncated]" : content;
        return { content: [{ type: "text" as const, text: truncated }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error reading file: ${(e as Error).message}` }] };
      }
    },
  );

  const queryKb = tool(
    "query_kb",
    "Query the rejection knowledge base for known patterns. Search by guideline ID (e.g. '5.1.1') or keyword.",
    {
      guideline_id: z.string().optional().describe("Guideline ID to look up (e.g. '2.1', '5.1.1')"),
      keyword: z.string().optional().describe("Keyword to search patterns (e.g. 'privacy', 'payment')"),
    },
    async (args) => {
      let results: unknown[] = [];

      if (args.guideline_id) {
        const gid = args.guideline_id;
        const matchingGuidelines = guidelines.guidelines.filter(
          (g: { id: string }) => g.id === gid || g.id.startsWith(gid),
        );
        const matchingPatterns = patterns.patterns.filter(
          (p: { guideline: string }) => p.guideline === gid || p.guideline.startsWith(gid),
        );
        results = [...matchingGuidelines.map((g: unknown) => ({ type: "guideline", ...g as object })), ...matchingPatterns.map((p: unknown) => ({ type: "pattern", ...p as object }))];
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
          ...kwGuidelines.map((g: unknown) => ({ type: "guideline", ...g as object })),
          ...kwPatterns.map((p: unknown) => ({ type: "pattern", ...p as object })),
        ];
      }

      if (results.length === 0) {
        return { content: [{ type: "text" as const, text: "No matching guidelines or patterns found." }] };
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    },
  );

  const runShiplint = tool(
    "run_shiplint",
    "Run ShipLint automated policy checker on the project. Returns scan results if ShipLint is installed, or a message that it's not available.",
    { path: z.string().optional().describe("Project path (defaults to current project)") },
    async () => {
      // Check if shiplint is available
      try {
        const { execSync } = await import("node:child_process");
        const result = execSync(`npx shiplint scan "${metadata.projectPath}" 2>&1`, {
          timeout: 30000,
          encoding: "utf-8",
        });
        return { content: [{ type: "text" as const, text: result }] };
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: "ShipLint is not installed or not available. Skipping automated policy checks. Continue with manual analysis.",
            },
          ],
        };
      }
    },
  );

  // Create MCP server with our tools
  const mcpServer = createSdkMcpServer({
    name: "shipagent-tools",
    version: "0.1.0",
    tools: [readProjectFile, queryKb, runShiplint],
  });

  const prompt = `Review this iOS project for App Store rejection risks.

## Project Metadata
${projectInfo}

## Available Source Files
${metadata.sourceFiles.slice(0, 50).join("\n")}
${metadata.sourceFiles.length > 50 ? `\n... and ${metadata.sourceFiles.length - 50} more files` : ""}

## Instructions
1. Start by querying the knowledge base for the most common rejection categories
2. Read any source files that might reveal issues (especially Swift files related to permissions, payments, auth)
3. Systematically check each guideline category
4. Return your findings as JSON

Begin your analysis.`;

  // Run the agent
  const conversation = query({
    prompt,
    options: {
      model: "claude-sonnet-4-20250514",
      systemPrompt: buildSystemPrompt(),
      cwd: metadata.projectPath,
      maxTurns: 15,
      tools: [], // disable built-in tools
      mcpServers: { "shipagent-tools": mcpServer },
      allowedTools: ["mcp__shipagent-tools__read_project_file", "mcp__shipagent-tools__query_kb", "mcp__shipagent-tools__run_shiplint"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      env: {
        ...process.env as Record<string, string>,
        ANTHROPIC_API_KEY: apiKey,
      },
      persistSession: false,
    },
  });

  let lastAssistantText = "";

  for await (const message of conversation) {
    if (message.type === "assistant" && "message" in message) {
      // Extract text from the assistant message
      const msg = message.message as { content?: Array<{ type: string; text?: string }> };
      if (msg.content) {
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            lastAssistantText = block.text;
          }
        }
      }
    }
  }

  // Parse findings from agent output
  const { parseAgentFindings } = await import("./report.js");
  return parseAgentFindings(lastAssistantText);
}
