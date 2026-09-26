import { describe, expect, it, vi } from "vitest";
import { MultiBotMessagingSurface } from "./multi-bot-messaging-surface.js";

function createSurface() {
  const defaultSink = vi.fn(async (_event: unknown) => {});
  const botSink = vi.fn(async (_event: unknown) => {});

  const defaultSurface = {
    describe: () => ({ id: "default", capabilities: { providers: ["slack"] } }),
    platforms: () => [{ provider: "slack", capabilities: { direct: true, groups: true } }],
    handleWebhook: vi.fn(async () => new Response("ok")),
    onInbound: (sink: (event: unknown) => Promise<void>) => {
      defaultSink.mockImplementation(sink);
    },
    sendToThread: vi.fn(async () => ({ handle: "default" })),
    openDirectThread: vi.fn(async () => "default-thread"),
    sendTyping: vi.fn(async () => undefined),
  };

  const botSurface = {
    describe: () => ({ id: "bot", capabilities: { providers: ["slack"] } }),
    platforms: () => [{ provider: "slack", capabilities: { direct: true, groups: true } }],
    handleWebhook: vi.fn(async () => new Response("bot-ok")),
    onInbound: (sink: (event: unknown) => Promise<void>) => {
      botSink.mockImplementation(sink);
    },
    sendToThread: vi.fn(async () => ({ handle: "bot" })),
    openDirectThread: vi.fn(async () => "bot-thread"),
    sendTyping: vi.fn(async () => undefined),
  };

  const botSurfaces = new Map([["bot-123", botSurface as never]]);
  const surface = new MultiBotMessagingSurface(defaultSurface as never, botSurfaces);

  return { surface, defaultSurface, botSurface, defaultSink, botSink };
}

describe("MultiBotMessagingSurface", () => {
  it("delegates describe and platforms to the default surface", () => {
    const { surface, defaultSurface } = createSurface();
    expect(surface.describe()).toEqual(defaultSurface.describe());
    expect(surface.platforms()).toEqual(defaultSurface.platforms());
  });

  it("routes webhooks with botId to the matching bot surface", async () => {
    const { surface, botSurface } = createSurface();
    const req = new Request("https://example.test/webhook", { method: "POST" });
    const res = await surface.handleWebhook("slack", req, "bot-123");
    expect(res).toEqual(new Response("bot-ok"));
    expect(botSurface.handleWebhook).toHaveBeenCalledWith("slack", req, "bot-123");
  });

  it("falls back to the default surface when botId is missing", async () => {
    const { surface, defaultSurface } = createSurface();
    const req = new Request("https://example.test/webhook", { method: "POST" });
    const res = await surface.handleWebhook("slack", req);
    expect(res).toEqual(new Response("ok"));
    expect(defaultSurface.handleWebhook).toHaveBeenCalledWith("slack", req, undefined);
  });

  it("falls back to the default surface when botId has no surface", async () => {
    const { surface, defaultSurface } = createSurface();
    const req = new Request("https://example.test/webhook", { method: "POST" });
    const res = await surface.handleWebhook("slack", req, "unknown-bot");
    expect(res).toEqual(new Response("ok"));
    expect(defaultSurface.handleWebhook).toHaveBeenCalledWith("slack", req, "unknown-bot");
  });

  it("injects botId into inbound messages from bot-specific surfaces", async () => {
    const { surface, defaultSink, botSink } = createSurface();
    const sink = vi.fn(async () => undefined);
    surface.onInbound(sink);

    const messageEvent = { type: "message", provider: "slack", from: "U123", content: "hi" } as const;
    botSink(messageEvent);

    expect(sink).toHaveBeenCalledWith({ ...messageEvent, botId: "bot-123" });
  });

  it("forwards non-message inbound events unchanged from bot surfaces", async () => {
    const { surface, botSink } = createSurface();
    const sink = vi.fn(async () => undefined);
    surface.onInbound(sink);

    const statusEvent = { type: "status", provider: "slack", handle: "h1", status: "sent" };
    botSink(statusEvent);

    expect(sink).toHaveBeenCalledWith(statusEvent);
  });

  it("does not inject botId into messages from the default surface", async () => {
    const { surface, defaultSink } = createSurface();
    const sink = vi.fn(async () => undefined);
    surface.onInbound(sink);

    const messageEvent = { type: "message", provider: "slack", from: "U123", content: "hi" } as const;
    defaultSink(messageEvent);

    expect(sink).toHaveBeenCalledWith(messageEvent);
  });

  it("routes sendToThread to the bot surface matching context.botId", async () => {
    const { surface, botSurface } = createSurface();
    const result = await surface.sendToThread(
      { threadId: "slack:C1", body: "hello" },
      { botId: "bot-123", signal: new AbortController().signal } as never,
    );
    expect(result).toEqual({ handle: "bot" });
    expect(botSurface.sendToThread).toHaveBeenCalledWith(
      { threadId: "slack:C1", body: "hello" },
      expect.objectContaining({ botId: "bot-123" }),
    );
  });

  it("falls back to the default surface for sendToThread when botId is missing", async () => {
    const { surface, defaultSurface } = createSurface();
    const result = await surface.sendToThread(
      { threadId: "slack:C1", body: "hello" },
      { signal: new AbortController().signal } as never,
    );
    expect(result).toEqual({ handle: "default" });
    expect(defaultSurface.sendToThread).toHaveBeenCalledWith(
      { threadId: "slack:C1", body: "hello" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("routes openDirectThread and sendTyping by botId", async () => {
    const { surface, botSurface, defaultSurface } = createSurface();
    const signal = new AbortController().signal;

    await surface.openDirectThread("slack", "U123", { botId: "bot-123", signal } as never);
    expect(botSurface.openDirectThread).toHaveBeenCalledWith("slack", "U123", expect.objectContaining({ botId: "bot-123" }));

    await surface.openDirectThread("slack", "U123", { signal } as never);
    expect(defaultSurface.openDirectThread).toHaveBeenCalledWith("slack", "U123", expect.objectContaining({ signal }));

    await surface.sendTyping("slack:C1", { botId: "bot-123", signal } as never);
    expect(botSurface.sendTyping).toHaveBeenCalledWith("slack:C1", expect.objectContaining({ botId: "bot-123" }));
  });
});
