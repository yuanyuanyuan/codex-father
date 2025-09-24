import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Low‑level rawExec test ------------------------------------------------------
// ---------------------------------------------------------------------------

import { exec as rawExec } from "../src/utils/agent/sandbox/raw-exec.js";

describe("rawExec – invalid command handling", () => {
  it("resolves with non‑zero exit code when executable is missing", async () => {
    const cmd = ["definitely-not-a-command-1234567890"];

    const result = await rawExec(cmd, {}, []);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Higher‑level handleExecCommand test ----------------------------------------
// ---------------------------------------------------------------------------

// Mock approvals and logging helpers so the test focuses on execution flow.
vi.mock("../src/approvals.js", () => {
  return {
    __esModule: true,
    canAutoApprove: () =>
      ({ type: "auto-approve", runInSandbox: false } as any),
    isSafeCommand: () => null,
  };
});

vi.mock("../src/format-command.js", () => {
  return {
    __esModule: true,
    formatCommandForDisplay: (cmd: Array<string>) => cmd.join(" "),
  };
});

vi.mock("../src/utils/agent/log.js", () => ({
  __esModule: true,
  log: () => {},
  isLoggingEnabled: () => false,
}));

import { handleExecCommand } from "../src/utils/agent/handle-exec-command.js";

describe("handleExecCommand – invalid executable", () => {
  it("returns non‑zero exit code for 'git show' as a single argv element", async () => {
    const execInput = { cmd: ["git show"] } as any;
    const config = { model: "any", instructions: "" } as any;
    const policy = { mode: "auto" } as any;
    const getConfirmation = async () => ({ review: "yes" } as any);

    const { outputText, metadata } = await handleExecCommand(
      execInput,
      config,
      policy,
      getConfirmation,
    );

    expect(metadata["exit_code"]).not.toBe(0);
    expect(String(outputText).length).toBeGreaterThan(0);
  });
});
