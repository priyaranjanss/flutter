import type { MessagingSurface } from "@rakazo/adapter-kit";
import type { Hono } from "hono";

export const MESSAGING_WEBHOOK_BASE_PATH = "/api/v1/messaging/webhook";

async function maybeHandleSlackUrlVerification(request: Request): Promise<Response | null> {
  if (request.method !== "POST") return null;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    const body = await request.clone().json();
    if (body && body.type === "url_verification" && typeof body.challenge === "string") {
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
  } catch {
    // not valid JSON or not a url_verification request; fall through
  }
  return null;
}

export function mountMessagingWebhookRoutes(app: Hono, deps: { messaging: MessagingSurface }) {
  app.all(`${MESSAGING_WEBHOOK_BASE_PATH}/:provider/:botId?`, async (c) => {
    const provider = c.req.param("provider");
    const botId = c.req.param("botId") ?? undefined;
    if (provider === "slack") {
      const verification = await maybeHandleSlackUrlVerification(c.req.raw);
      if (verification) return verification;
    }
    console.log(`📨 [WEBHOOK] Received ${c.req.method} request for provider "${provider}"${botId ? ` (bot ${botId})` : ""}`);
    const response = await deps.messaging.handleWebhook(provider, c.req.raw, botId);
    if (!response) {
      console.error(`❌ [WEBHOOK] Unknown provider "${provider}" or webhook disabled`);
      return c.json({ error: "Unknown provider" }, 404);
    }
    if (!response.ok) {
      console.warn(`⚠️ [WEBHOOK] Provider "${provider}" returned HTTP ${response.status}`);
    } else {
      console.log(`✅ [WEBHOOK] Provider "${provider}" webhook processed successfully (HTTP ${response.status})`);
    }
    return response;
  });
  app.post("/api/v1/phone/webhook", async (c) => {
    const response = deps.messaging.handleWebhook("sendblue", c.req.raw, undefined);
    if (!response) return c.json({ error: "Unknown provider" }, 404);
    return response;
  });
}
