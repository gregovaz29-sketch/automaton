export const SAFE_DEMO_BLOCKED_CAPABILITIES = ["wallets and payments", "network access", "shell commands", "file writes", "port exposure", "self-modification", "replication"] as const;

export interface SafeLocalDemoReport {
  mode: "safe-local-demo";
  task: string;
  network: false;
  writes: false;
  externalCredentials: false;
  blockedCapabilities: readonly string[];
}

export function createSafeLocalDemoReport(task?: string): SafeLocalDemoReport {
  return { mode: "safe-local-demo", task: task?.trim() || "Preflight: verify the safe local demo environment.", network: false, writes: false, externalCredentials: false, blockedCapabilities: SAFE_DEMO_BLOCKED_CAPABILITIES };
}