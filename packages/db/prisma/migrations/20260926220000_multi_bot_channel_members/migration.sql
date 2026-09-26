-- Allow multiple linked identities per address in a channel: the same
-- Slack user can now have one membership row per bot identity.
DROP INDEX "messaging_channel_members_channelId_address_key";
CREATE UNIQUE INDEX "messaging_channel_members_channelId_identityId_address_key"
    ON "messaging_channel_members"("channelId", "identityId", "address");
