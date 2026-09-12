import { describe, expect, it } from "vitest";
import { SAFE_DEMO_BLOCKED_CAPABILITIES, createSafeLocalDemoReport } from "../demo/safe-local-demo.js";

describe("safe local demo", () => {
  it("uses no network, writes, or credentials", () => expect(createSafeLocalDemoReport()).toMatchObject({ mode: "safe-local-demo", network: false, writes: false, externalCredentials: false }));
  it("keeps every high-risk capability blocked", () => expect(SAFE_DEMO_BLOCKED_CAPABILITIES).toEqual(expect.arrayContaining(["wallets and payments", "shell commands", "self-modification", "replication"])));
  it("accepts a local task label without executing it", () => expect(createSafeLocalDemoReport("  revisar una nota  ").task).toBe("revisar una nota"));
});