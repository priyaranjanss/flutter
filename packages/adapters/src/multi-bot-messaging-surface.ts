import type { AdapterContext, MessagingInboundEvent, MessagingInboundMessage, MessagingSendRequest, MessagingSurface } from "@rakazo/adapter-kit";

/**
 * Wraps a default messaging surface plus per-bot surfaces. Webhooks routed
 * with a `botId` path segment are dispatched to the matching bot surface;
 * all others fall back to the default. Outbound sends route to the surface
 * that owns `context.botId`, or the default when no bot is specified.
 */
export class MultiBotMessagingSurface implements MessagingSurface {
  private readonly defaultSurface: MessagingSurface;
  private readonly botSurfaces: Map<string, MessagingSurface>;
  private sink: ((event: MessagingInboundEvent) => Promise<void>) | undefined;

  constructor(
    defaultSurface: MessagingSurface,
    botSurfaces: Map<string, MessagingSurface>,
  ) {
    this.defaultSurface = defaultSurface;
    this.botSurfaces = botSurfaces;
  }

  describe() {
    return this.defaultSurface.describe();
  }

  platforms() {
    return this.defaultSurface.platforms();
  }

  handleWebhook(provider: string, request: Request, botId?: string): Promise<Response> | null {
    if (botId) {
      const surface = this.botSurfaces.get(botId);
      if (surface) return surface.handleWebhook(provider, request, botId);
    }
    return this.defaultSurface.handleWebhook(provider, request, botId);
  }

  onInbound(sink: (event: MessagingInboundEvent) => Promise<void>): void {
    this.sink = sink;
    this.defaultSurface.onInbound(sink);
    for (const [botId, surface] of this.botSurfaces) {
      surface.onInbound((event) => {
        if (event.type === "message") {
          return sink({ ...(event as MessagingInboundMessage), botId });
        }
        return sink(event);
      });
    }
  }

  async sendToThread(request: MessagingSendRequest, context: AdapterContext): Promise<{ handle: string }> {
    const botId = context.botId;
    if (botId) {
      const surface = this.botSurfaces.get(botId);
      if (surface) return surface.sendToThread(request, context);
    }
    return this.defaultSurface.sendToThread(request, context);
  }

  async openDirectThread(
    provider: string,
    address: string,
    context: AdapterContext,
  ): Promise<string> {
    const botId = context.botId;
    if (botId) {
      const surface = this.botSurfaces.get(botId);
      if (surface) return surface.openDirectThread(provider, address, context);
    }
    return this.defaultSurface.openDirectThread(provider, address, context);
  }

  async sendTyping(threadId: string, context: AdapterContext): Promise<void> {
    const botId = context.botId;
    if (botId) {
      const surface = this.botSurfaces.get(botId);
      if (surface) return surface.sendTyping(threadId, context);
    }
    return this.defaultSurface.sendTyping(threadId, context);
  }

  async initialize?(): Promise<void> {
    await this.defaultSurface.initialize?.();
    await Promise.all(
      [...this.botSurfaces.values()].map((surface) => surface.initialize?.()),
    );
  }

  async shutdown?(): Promise<void> {
    await this.defaultSurface.shutdown?.();
    await Promise.all(
      [...this.botSurfaces.values()].map((surface) => surface.shutdown?.()),
    );
  }
}
