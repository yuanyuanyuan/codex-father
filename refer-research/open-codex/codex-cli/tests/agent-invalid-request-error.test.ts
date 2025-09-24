import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const openAiState: { createSpy?: ReturnType<typeof vi.fn> } = {};

vi.mock("openai", () => {
  class FakeOpenAI {
    public chat = {
      completions: {
        create: (...args: Array<any>) => openAiState.createSpy!(...args),
      },
    };
  }

  class APIConnectionTimeoutError extends Error {}

  return {
    __esModule: true,
    default: FakeOpenAI,
    APIConnectionTimeoutError,
  };
});

vi.mock("../src/approvals.js", () => ({
  __esModule: true,
  alwaysApprovedCommands: new Set<string>(),
  canAutoApprove: () => ({ type: "auto-approve", runInSandbox: false } as any),
  isSafeCommand: () => null,
}));

vi.mock("../src/format-command.js", () => ({
  __esModule: true,
  formatCommandForDisplay: (c: Array<string>) => c.join(" "),
}));

vi.mock("../src/utils/agent/log.js", () => ({
  __esModule: true,
  log: () => {},
  isLoggingEnabled: () => false,
}));

import { AgentLoop } from "../src/utils/agent/agent-loop.js";

describe("AgentLoop – invalid request / 4xx errors", () => {
  it("shows system message and resolves on invalid_request_error", async () => {
    const err: any = new Error("Invalid request: model not found");
    err.code = "invalid_request_error";
    err.status = 400;

    openAiState.createSpy = vi.fn(async () => {
      throw err;
    });

    const received: Array<any> = [];

    const agent = new AgentLoop({
      model: "any",
      instructions: "",
      approvalPolicy: { mode: "auto" } as any,
      onItem: (i) => received.push(i),
      onLoading: () => {},
      getCommandConfirmation: async () => ({ review: "yes" } as any),
      onReset: () => {},
    });

    const userMsg = [
      {
        role: "user",
        content: [{ type: "text", text: "hello" }],
      },
    ];

    await expect(agent.run(userMsg as any)).resolves.not.toThrow();

    await new Promise((r) => setTimeout(r, 20));

    const sysMsg = received.find(
      (i) =>
        i.role === "assistant" &&
        typeof i.content?.[0]?.text === "string" &&
        i.content[0].text.includes("OpenAI rejected"),
    );

    expect(sysMsg).toBeTruthy();
  });
});
