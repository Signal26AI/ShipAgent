import * as fs from "node:fs";
import * as path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
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

// --- Tool definitions ---

const fixTools: Anthropic.Tool[] = [
  {
    name: "read_project_file",
    description:
      "Read the contents of a file from the iOS project. Use relative paths from the project root.",
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
    name: "write_project_file",
    description:
      "Write (create or overwrite) a file in the iOS project. Use relative paths from the project root.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file relative to the project root",
        },
        content: {
          type: "string",
          description: "Full content to write to the file",
        },
      },
      required: ["file_path", "content"],
    },
  },
  {
    name: "edit_project_file",
    description:
      "Edit a file in the iOS project by replacing exact text. The old_text must match exactly (including whitespace).",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file relative to the project root",
        },
        old_text: {
          type: "string",
          description: "Exact text to find and replace",
        },
        new_text: {
          type: "string",
          description: "New text to replace with",
        },
      },
      required: ["file_path", "old_text", "new_text"],
    },
  },
  {
    name: "query_kb",
    description:
      "Query the rejection knowledge base for known patterns and fix examples. Search by guideline ID or keyword.",
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

function executeFixTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  projectPath: string,
): string {
  switch (toolName) {
    case "read_project_file": {
      const args = toolInput as { file_path: string };
      const fullPath = path.resolve(projectPath, args.file_path);
      if (!fullPath.startsWith(projectPath)) return "Error: Path is outside the project directory";
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        return content.length > 50000 ? content.slice(0, 50000) + "\n[...truncated]" : content;
      } catch (e) {
        return `Error reading file: ${(e as Error).message}`;
      }
    }
    case "write_project_file": {
      const args = toolInput as { file_path: string; content: string };
      const fullPath = path.resolve(projectPath, args.file_path);
      if (!fullPath.startsWith(projectPath)) return "Error: Path is outside the project directory";
      try {
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, args.content);
        return `Successfully wrote ${args.content.length} bytes to ${args.file_path}`;
      } catch (e) {
        return `Error writing file: ${(e as Error).message}`;
      }
    }
    case "edit_project_file": {
      const args = toolInput as { file_path: string; old_text: string; new_text: string };
      const fullPath = path.resolve(projectPath, args.file_path);
      if (!fullPath.startsWith(projectPath)) return "Error: Path is outside the project directory";
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (!content.includes(args.old_text)) {
          return `Error: old_text not found in ${args.file_path}. Make sure it matches exactly.`;
        }
        fs.writeFileSync(fullPath, content.replace(args.old_text, args.new_text));
        return `Successfully edited ${args.file_path}`;
      } catch (e) {
        return `Error editing file: ${(e as Error).message}`;
      }
    }
    case "query_kb": {
      const args = toolInput as { guideline_id?: string; keyword?: string };
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
    default:
      return `Unknown tool: ${toolName}`;
  }
}

// --- Fix prompt ---

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

// --- Public API ---

export async function runFix(
  projectPath: string,
  findings: Finding[],
  apiKey: string,
): Promise<FixResult> {
  const absPath = path.resolve(projectPath);

  // Filter to actionable findings only
  const actionable = findings.filter(
    (f) => f.severity === "high" || f.severity === "medium",
  );

  if (actionable.length === 0) {
    return { fixes: [], skipped: [] };
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt =
    "You are the ShipAgent Fix Agent. You fix iOS App Store compliance issues in project files. Be precise and conservative in your edits.";

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildFixPrompt(actionable) },
  ];

  const maxTurns = 20;

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools: fixTools,
      messages,
    });

    // If done, extract text and parse
    if (response.stop_reason === "end_turn") {
      let text = "";
      for (const block of response.content) {
        if (block.type === "text") text += block.text;
      }
      return parseFixResult(text);
    }

    // Handle tool calls
    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = executeFixTool(block.name, block.input as Record<string, unknown>, absPath);
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

  return { fixes: [], skipped: [] };
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
