import { execSync as realExec, spawnSync as realSpawn } from "node:child_process";

export const MARKETPLACE_SOURCE = "repleadfy/pipeit";
export const MARKETPLACE_NAME = "repleadfy";
export const PLUGIN = "pipeit";

type SpawnFn = (cmd: string, args: string[]) => { status: number | null };
type ExecFn = (cmd: string) => void;
type LogFn = (line: string) => void;

export function hasClaudeCli(spawn: SpawnFn = (c, a) => realSpawn(c, a, { stdio: "ignore" })): boolean {
  const r = spawn("claude", ["--version"]);
  return r.status === 0;
}

export function tryInstallViaCli(exec: ExecFn = (c) => { realExec(c, { stdio: "inherit" }); }): boolean {
  try {
    exec(`claude plugin marketplace add ${MARKETPLACE_SOURCE}`);
    exec(`claude plugin install ${PLUGIN}@${MARKETPLACE_NAME}`);
    return true;
  } catch {
    return false;
  }
}

export function printManualInstructions(log: LogFn = console.log): void {
  log("");
  log("Run these two commands inside Claude Code:");
  log("");
  log(`  /plugin marketplace add ${MARKETPLACE_SOURCE}`);
  log(`  /plugin install ${PLUGIN}@${MARKETPLACE_NAME}`);
  log("");
}

export function printNextStep(log: LogFn = console.log): void {
  log("✓ pipeit ready");
  log("");
  log("Next step:");
  log("  In Claude Code, run  /pipeit");
  log("  Your browser will open once to sign in (Google / GitHub / email).");
  log("");
}
