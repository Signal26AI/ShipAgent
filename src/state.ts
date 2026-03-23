import * as fs from "node:fs";
import * as path from "node:path";
import type { Finding } from "./report.js";

export interface FixRecord {
  file: string;
  change: string;
  guideline: string;
  timestamp: string;
}

export interface FixHistory {
  fixes: FixRecord[];
  skipped: Array<{ guideline: string; reason: string }>;
  timestamp: string;
}

export interface ShipAgentConfig {
  maxIterations?: number;
  autoFix?: boolean;
}

const STATE_DIR = ".shipagent";

function ensureStateDir(projectPath: string): string {
  const stateDir = path.join(projectPath, STATE_DIR);
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  // Add .shipagent/ to .gitignore if it exists and doesn't already include it
  const gitignorePath = path.join(projectPath, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (!content.includes(STATE_DIR)) {
      fs.appendFileSync(gitignorePath, `\n# ShipAgent state\n${STATE_DIR}/\n`);
    }
  }
  return stateDir;
}

export function saveReview(projectPath: string, findings: Finding[]): void {
  const stateDir = ensureStateDir(projectPath);
  const data = {
    findings,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(stateDir, "last-review.json"),
    JSON.stringify(data, null, 2),
  );
}

export function loadLastReview(
  projectPath: string,
): { findings: Finding[]; timestamp: string } | null {
  const filePath = path.join(projectPath, STATE_DIR, "last-review.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function saveFixHistory(
  projectPath: string,
  history: FixHistory,
): void {
  const stateDir = ensureStateDir(projectPath);
  fs.writeFileSync(
    path.join(stateDir, "fix-history.json"),
    JSON.stringify(history, null, 2),
  );
}

export function loadFixHistory(projectPath: string): FixHistory | null {
  const filePath = path.join(projectPath, STATE_DIR, "fix-history.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function saveConfig(
  projectPath: string,
  config: ShipAgentConfig,
): void {
  const stateDir = ensureStateDir(projectPath);
  fs.writeFileSync(
    path.join(stateDir, "config.json"),
    JSON.stringify(config, null, 2),
  );
}

export function loadConfig(projectPath: string): ShipAgentConfig | null {
  const filePath = path.join(projectPath, STATE_DIR, "config.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
