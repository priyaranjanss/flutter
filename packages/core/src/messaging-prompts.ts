import type { MessageBlock } from "@rakazo/contracts";

/** Instruction-stack note for bots whose owner has a messaging identity. */
export function messagingDmSurfaceNote(): string {
  return [
    "Chat surface: the owner also reaches you over a messaging app (iMessage/SMS, Slack, WhatsApp, or similar).",
    "That conversation and this one are the same thread; anything you reply here is mirrored to their chat.",
    "Keep replies concise. They arrive as chat messages.",
  ].join(" ");
}

/** Hard privacy rules for bots posting into shared group channels. */
export function messagingChannelPrivacyBlock(botName?: string): string {
  const name = botName?.trim() || "this bot";
  return [
    "You are posting to a group chat with multiple people through the deployment's shared messaging line.",
    `You ARE ${name}. Speak directly in the first person ("I", "my") as ${name}. Never speak about ${name} or yourself in the third person.`,
    "Do not include any speaker prefixes, attribution labels, or '<Name>'s agent:' prefixes in your output text.",
    "Never reveal or share the owner's personal information, memory contents, scratchpad, or 1:1 conversation contents in the group.",
    "Reply only when you add value to the group; otherwise finish silently without posting.",
  ].join("\n");
}

export function messagingChannelId(sourceBlocks: MessageBlock[] | undefined): string | undefined {
  return sourceBlocks?.find((block) => block.kind === "channel_message")?.channelId;
}

/** Channel runs are messaging runs whose waking message came from a channel. */
export function isMessagingChannelRun(
  trigger: string,
  sourceBlocks: MessageBlock[] | undefined,
): boolean {
  return trigger === "messaging" && Boolean(messagingChannelId(sourceBlocks));
}

/**
 * Group names and owner names are attacker-controlled text interpolated
 * into prompts and DMs; strip framing characters before they get near one.
 */
export function sanitizeMessagingLabel(value: string): string {
  return value
    .replace(/[\r\n"[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}
