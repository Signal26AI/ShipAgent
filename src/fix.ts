import * as fs from "node:fs";
import * as path from "node:path";
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";
import type { ProjectMetadata } from "./reader.js";
import type { Finding } from "./report.js";
import type { FixRecord } from "./state.js";

// Load KB data
const kbDir = path.join(import.meta.dirname, "kb");
const guidelines = JSON.parse(fs.readFileSync(path.join(kbDir, "guidelines.json"), "utf-8"));
const patterns = JSON.parse(fs.readFileSync(path.join(kbDir, "patterns.json"), "utf-8"));

export interface FixResult {
  fixes: FixRecord[];
  skipped: Array<{ guideline: string; reason: string }>;
}

function buildFixPrompt(findings: Finding[]): string {
  return `You are ShipAgent Fix Agent. Your job is to apply fixes to an iOS project based on review findings.

## Review Findings to Fix
${JSON.stringify(findings, null, 2)}

## Process
For EACH finding above (only high and medium severity):
1. Use query_kb to look up the guideline and find fix examples/patterns
2. Use read_project_file to examine the relevant files
3. Apply the fix using edit_project_file (for modifications) or write_project_file (for new files)
4. If a fix requires information you don't have (e.g., a real privacy policy URL), use a reasonable placeholder and note it

## Fix Guidelines
- For missing privacy manifest: Create a PrivacyInfo.xcprivacy file with appropriate entries
- For vague permission strings: Rewrite with specific, user-friendly descriptions explaining WHY the permission is needed
- For missing privacy policy URL: Add a placeholder URL that the developer should replace
- For placeholder content: Replace with reasonable defaults
- Be conservative — only change what's needed to address each finding
- Do NOT break existing functionality

## Output Format
After applying all fixes, output ONLY a JSON code block summarizing what you did:
\`\`\`json
{
  "fixes": [
    {
      "file": "relative/path/to/file",
      "change": "Description of what was changed",
      "guideline": "5.1.1"
    }
  ],
  "skipped": [
    {
      "guideline": "3.1.1",
      "reason": "Requires App Store Connect configuration, cannot fix locally"
    }
  ]
}
\`\`\`

Begin fixing.`;
}

export async function runFix(
  metadata: ProjectMetadata,
  findings: Finding[],
  apiKey: string,
): Promise<FixResult> {
  // Filter to actionable findings only
  const actionable = findings.filter(
    (f) => f.severity === "high" || f.severity === "medium",
  );

  if (actionable.length === 0) {
    return { fixes: [], skipped: [] };
  }

  // Define MCP tools — same read tools as review + write tools
  const readProjectFile = tool(
    "read_project_file",
    "Read the contents of a file from the iOS project. Use relative paths from the project root.",
    { file_path: z.string().describe("Path to the file relative to the project root") },
    async (args) => {
      const fullPath = path.resolve(metadata.projectPath, args.file_path);
      if (!fullPath.startsWith(metadata.projectPath)) {
        return { content: [{ type: "text" as const, text: "Error: Path is outside the project directory" }] };
      }
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const truncated = content.length > 50000 ? content.slice(0, 50000) + "\n[...truncated]" : content;
        return { content: [{ type: "text" as const, text: truncated }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error reading file: ${(e as Error).message}` }] };
      }
    },
  );

  const writeProjectFile = tool(
    "write_project_file",
    "Write (create or overwrite) a file in the iOS project. Use relative paths from the project root.",
    {
      file_path: z.string().describe("Path to the file relative to the project root"),
      content: z.string().describe("Full content to write to the file"),
    },
    async (args) => {
      const fullPath = path.resolve(metadata.projectPath, args.file_path);
      if (!fullPath.startsWith(metadata.projectPath)) {
        return { content: [{ type: "text" as const, text: "Error: Path is outside the project directory" }] };
      }
      try {
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, args.content);
        return { content: [{ type: "text" as const, text: `Successfully wrote ${args.content.length} bytes to ${args.file_path}` }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error writing file: ${(e as Error).message}` }] };
      }
    },
  );

  const editProjectFile = tool(
    "edit_project_file",
    "Edit a file in the iOS project by replacing exact text. The old_text must match exactly (including whitespace).",
    {
      file_path: z.string().describe("Path to the file relative to the project root"),
      old_text: z.string().describe("Exact text to find and replace"),
      new_text: z.string().describe("New text to replace with"),
    },
    async (args) => {
      const fullPath = path.resolve(metadata.projectPath, args.file_path);
      if (!fullPath.startsWith(metadata.projectPath)) {
        return { content: [{ type: "text" as const, text: "Error: Path is outside the project directory" }] };
      }
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (!content.includes(args.old_text)) {
          return { content: [{ type: "text" as const, text: `Error: old_text not found in ${args.file_path}. Make sure it matches exactly.` }] };
        }
        const newContent = content.replace(args.old_text, args.new_text);
        fs.writeFileSync(fullPath, newContent);
        return { content: [{ type: "text" as const, text: `Successfully edited ${args.file_path}` }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error editing file: ${(e as Error).message}` }] };
      }
    },
  );

  const queryKb = tool(
    "query_kb",
    "Query the rejection knowledge base for known patterns and fix examples. Search by guideline ID or keyword.",
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
        results = [
          ...matchingGuidelines.map((g: unknown) => ({ type: "guideline", ...g as object })),
          ...matchingPatterns.map((p: unknown) => ({ type: "pattern", ...p as object })),
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

  const mcpServer = createSdkMcpServer({
    name: "shipagent-fix-tools",
    version: "0.1.0",
    tools: [readProjectFile, writeProjectFile, editProjectFile, queryKb],
  });

  const conversation = query({
    prompt: buildFixPrompt(actionable),
    options: {
      model: "claude-sonnet-4-20250514",
      systemPrompt: "You are the ShipAgent Fix Agent. You fix iOS App Store compliance issues in project files. Be precise and conservative in your edits.",
      cwd: metadata.projectPath,
      maxTurns: 20,
      tools: [],
      mcpServers: { "shipagent-fix-tools": mcpServer },
      allowedTools: [
        "mcp__shipagent-fix-tools__read_project_file",
        "mcp__shipagent-fix-tools__write_project_file",
        "mcp__shipagent-fix-tools__edit_project_file",
        "mcp__shipagent-fix-tools__query_kb",
      ],
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

  return parseFixResult(lastAssistantText);
}

function parseFixResult(agentOutput: string): FixResult {
  const now = new Date().toISOString();

  // Try JSON code block
  const jsonMatch = agentOutput.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        fixes: (parsed.fixes || []).map((f: FixRecord) => ({ ...f, timestamp: now })),
        skipped: parsed.skipped || [],
      };
    } catch {
      // fall through
    }
  }

  // Try direct parse
  try {
    const parsed = JSON.parse(agentOutput);
    return {
      fixes: (parsed.fixes || []).map((f: FixRecord) => ({ ...f, timestamp: now })),
      skipped: parsed.skipped || [],
    };
  } catch {
    // fall through
  }

  return { fixes: [], skipped: [] };
}
