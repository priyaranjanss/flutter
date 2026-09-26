-- Per-bot Slack credentials: each bot can have its own Slack app.
CREATE TABLE "bot_messaging_credentials" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "workspaceId" TEXT,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_messaging_credentials_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bot_messaging_credentials_botId_provider_key"
    ON "bot_messaging_credentials"("botId", "provider");
CREATE INDEX "bot_messaging_credentials_provider_workspaceId_idx"
    ON "bot_messaging_credentials"("provider", "workspaceId");

-- Allow the same chat address to be linked to multiple bots via different
-- Slack apps: widen the identity unique key from (provider, address) to
-- (provider, address, botId).
DROP INDEX "messaging_identities_provider_address_key";
CREATE UNIQUE INDEX "messaging_identities_provider_address_botId_key"
    ON "messaging_identities"("provider", "address", "botId");
