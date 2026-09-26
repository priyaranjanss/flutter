import type { PrismaClient } from "./client.js";

export interface BotMessagingCredentialRecord {
  id: string;
  botId: string;
  provider: string;
  workspaceId: string | null;
  config: {
    botToken: string;
    signingSecret: string;
  };
  createdAt: string;
  updatedAt: string;
}

export async function listBotMessagingCredentials(
  prisma: PrismaClient,
  input: { spaceId: string; botId?: string },
): Promise<BotMessagingCredentialRecord[]> {
  const where = input.botId
    ? { spaceId: input.spaceId, botId: input.botId }
    : { spaceId: input.spaceId };
  const rows = await prisma.botMessagingCredential.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    botId: row.botId,
    provider: row.provider,
    workspaceId: row.workspaceId,
    config: row.config as BotMessagingCredentialRecord["config"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getBotMessagingCredential(
  prisma: PrismaClient,
  input: { id: string; spaceId: string },
): Promise<BotMessagingCredentialRecord | null> {
  const row = await prisma.botMessagingCredential.findFirst({
    where: { id: input.id, bot: { spaceId: input.spaceId } },
  });
  if (!row) return null;
  return {
    id: row.id,
    botId: row.botId,
    provider: row.provider,
    workspaceId: row.workspaceId,
    config: row.config as BotMessagingCredentialRecord["config"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createBotMessagingCredential(
  prisma: PrismaClient,
  input: {
    spaceId: string;
    botId: string;
    provider: string;
    workspaceId?: string;
    config: BotMessagingCredentialRecord["config"];
  },
): Promise<BotMessagingCredentialRecord> {
  const row = await prisma.botMessagingCredential.create({
    data: {
      botId: input.botId,
      provider: input.provider,
      workspaceId: input.workspaceId ?? null,
      config: input.config,
    },
  });
  return {
    id: row.id,
    botId: row.botId,
    provider: row.provider,
    workspaceId: row.workspaceId,
    config: row.config as BotMessagingCredentialRecord["config"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updateBotMessagingCredential(
  prisma: PrismaClient,
  input: {
    id: string;
    spaceId: string;
    config?: BotMessagingCredentialRecord["config"];
    workspaceId?: string | null;
  },
): Promise<BotMessagingCredentialRecord | null> {
  const existing = await prisma.botMessagingCredential.findFirst({
    where: { id: input.id, bot: { spaceId: input.spaceId } },
  });
  if (!existing) return null;
  const row = await prisma.botMessagingCredential.update({
    where: { id: input.id },
    data: {
      ...(input.config ? { config: input.config } : {}),
      ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}),
    },
  });
  return {
    id: row.id,
    botId: row.botId,
    provider: row.provider,
    workspaceId: row.workspaceId,
    config: row.config as BotMessagingCredentialRecord["config"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function deleteBotMessagingCredential(
  prisma: PrismaClient,
  input: { id: string; spaceId: string },
): Promise<boolean> {
  const existing = await prisma.botMessagingCredential.findFirst({
    where: { id: input.id, bot: { spaceId: input.spaceId } },
  });
  if (!existing) return false;
  await prisma.botMessagingCredential.delete({ where: { id: input.id } });
  return true;
}
