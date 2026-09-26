import { describe, expect, it, vi } from "vitest";

vi.mock("@earendil-works/pi-agent-core", () => ({
  Agent: class {
    state = { errorMessage: "WebSocket closed 1006", messages: [] };

    subscribe() {}
    async prompt() {}
    async waitForIdle() {}
    abort() {}
  },
}));

vi.mock("@earendil-works/pi-ai/providers/all", () => ({
  builtinModels: () => ({
    getModel: () => ({ provider: "openai-codex", id: "gpt-test" }),
    setProvider: vi.fn(),
    streamSimple: vi.fn(),
  }),
}));

vi.mock("./pi-local-provider.js", () => ({
  registerLocalProvider: (models: unknown) => models,
}));

vi.mock("./pi-openai-compatible-provider.js", () => ({
  OPENAI_COMPATIBLE_PROVIDER_ID: "openai-compatible",
  registerOpenAiCompatibleCatalog: (models: unknown) => models,
  registerOpenAiCompatibleRuntime: (models: unknown) => models,
}));

import { PiAgentRuntime, formatUserFacingProviderError } from "./pi-runtime.js";

describe("Pi runtime errors", () => {
  it("propagates provider failures instead of completing with error text", async () => {
    const runtime = new PiAgentRuntime();
    const consume = async () => {
      for await (const _event of runtime.run(
        {
          botId: "bot",
          threadId: "thread",
          runId: "run",
          prompt: "continue",
          instructions: "test",
          history: [],
          tools: [],
          model: { provider: "openai-codex", id: "gpt-test" },
        },
        {
          operationId: "operation",
          traceId: "trace",
          spaceId: "workspace",
          userId: "user",
          signal: new AbortController().signal,
        },
      )) {
        // Consume the stream so terminal failures surface to the executor.
      }
    };

    await expect(consume()).rejects.toThrow("WebSocket closed 1006");
  });

  it("formats structured Kilo Gateway 429 rate limit errors into user-friendly text", () => {
    const rawError =
      '429: {"message":"Provider returned error","code":429,"metadata":{"raw":"{\\"error\\":\\"Rate limit exceeded\\"}\\n","provider_name":"Poolside","is_byok":true,"limit_source":"upstream_provider_account","remedy_hint":"The provider rate-limited your own key."}}';
    const formatted = formatUserFacingProviderError("kilo", rawError);
    expect(formatted).toBe(
      "Rate limit exceeded on Poolside (Kilo Free). The provider rate-limited requests. Please wait a moment or select another model.",
    );
  });

  it("formats 402 paid model credit errors cleanly", () => {
    const rawError = '402: {"title":"Paid Model - Credits Required","message":"Add credits to continue","balance":0}';
    const formatted = formatUserFacingProviderError("kilo", rawError);
    expect(formatted).toBe(
      "Paid model credits required on Kilo Gateway. Please switch to a free model (e.g. Kilo Auto (Free)) or add credits to your account.",
    );
  });
});
