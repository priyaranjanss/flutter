import { Trans, useLingui } from "@lingui/react/macro";
import type {
  Bot,
  ExternalConversation,
  MessagingAgentConnection,
  MessagingChannelMembership,
  MessagingStatus,
} from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import { CheckIcon, CopyIcon, InfoIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { MessagingCredential } from "@rakazo/contracts";
import { providerLabel } from "../lib/messaging";
import { rpc } from "../lib/rpc";
import { ExternalConversationSettings } from "./ExternalConversationSettings";

export function MessagingSettingsOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useLingui();
  const [status, setStatus] = useState<MessagingStatus | null>(null);
  const [channels, setChannels] = useState<MessagingChannelMembership[]>([]);
  const [connections, setConnections] = useState<MessagingAgentConnection[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [externalConversations, setExternalConversations] = useState<ExternalConversation[]>([]);
  const [settingsConversationId, setSettingsConversationId] = useState<string | null>(null);
  const [linkBotId, setLinkBotId] = useState("");
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSlackGuide, setShowSlackGuide] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [credentials, setCredentials] = useState<MessagingCredential[]>([]);
  const [credForm, setCredForm] = useState({
    botId: "",
    signingSecret: "",
    botToken: "",
    editingId: "" as string | null,
  });
  const [credPending, setCredPending] = useState(false);

  const slackWebhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/v1/messaging/webhook/slack`
      : "/api/v1/messaging/webhook/slack";

  function copyWebhook() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(slackWebhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
  }

  async function refresh() {
    setError(null);
    const results = await Promise.allSettled([
      rpc.messaging.status(),
      rpc.messaging.channels.list(),
      rpc.messaging.connections.list(),
      rpc.bots.list(),
      rpc.spaces.list(),
      rpc.messaging.credentials.list(),
    ]);

    const [statusRes, channelsRes, connectionsRes, botsRes, spacesRes, credentialsRes] = results;

    if (statusRes.status === "fulfilled") setStatus(statusRes.value);
    if (channelsRes.status === "fulfilled") setChannels(channelsRes.value);
    if (connectionsRes.status === "fulfilled") setConnections(connectionsRes.value);
    if (botsRes.status === "fulfilled") setBots(botsRes.value);
    if (spacesRes.status === "fulfilled") {
      setExternalConversations(spacesRes.value.current.externalConversations);
    }
    if (credentialsRes.status === "fulfilled") setCredentials(credentialsRes.value);

    if (statusRes.status === "rejected" && botsRes.status === "rejected") {
      setError(t`Couldn't load messaging settings`);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    setLinkCode(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t`Couldn't update messaging settings`;
      setError(message);
    }
  }

  const linkedBotIds = new Set(status?.identities.map((identity) => identity.botId) ?? []);

  function resetCredForm() {
    setCredForm({ botId: "", signingSecret: "", botToken: "", editingId: null });
    setCredPending(false);
  }

  async function submitCredential() {
    if (!credForm.botId || !credForm.signingSecret || !credForm.botToken) return;
    setCredPending(true);
    setError(null);
    try {
      if (credForm.editingId) {
        await rpc.messaging.credentials.update({
          id: credForm.editingId,
          config: {
            botToken: credForm.botToken,
            signingSecret: credForm.signingSecret,
          },
        });
      } else {
        await rpc.messaging.credentials.create({
          botId: credForm.botId,
          provider: "slack",
          config: {
            botToken: credForm.botToken,
            signingSecret: credForm.signingSecret,
          },
        });
      }
      resetCredForm();
      await refresh();
    } catch {
      setError(t`Couldn't save Slack credentials`);
      setCredPending(false);
    }
  }

  async function removeCredential(id: string) {
    setError(null);
    try {
      await rpc.messaging.credentials.remove({ id });
      await refresh();
    } catch {
      setError(t`Couldn't remove Slack credentials`);
    }
  }

  function startEditCredential(cred: MessagingCredential) {
    setCredForm({
      botId: cred.botId,
      signingSecret: "",
      botToken: "",
      editingId: cred.id,
    });
  }

  const agentByIdentity = new Map(status?.identities.map((i) => [i.id, i.botName]) ?? []);
  function channelMeta(channel: MessagingChannelMembership): string {
    return [
      providerLabel(channel.provider),
      // Only meaningful once a second chat app is linked: the same group can
      // then hold two of the caller's memberships, one per agent.
      agentByIdentity.size > 1 ? agentByIdentity.get(channel.identityId) : undefined,
      channel.status,
      String(channel.memberCount),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        data-testid="messaging-settings"
        showCloseButton={false}
        className="rk-scroll block max-h-[calc(100%-2rem)] w-[640px] overflow-y-auto rounded-2xl p-6 sm:max-h-[calc(100%-5rem)] sm:max-w-[calc(100%-5rem)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-6">
          <DialogTitle className="text-2xl font-medium text-foreground">
            <Trans>Messaging</Trans>
          </DialogTitle>
          <DialogClose
            aria-label={t`Close messaging settings`}
            render={<Button variant="ghost" size="icon-sm" />}
          >
            <XIcon />
          </DialogClose>
        </div>

        {error ? <p className="mt-4 text-[13px] text-destructive">{error}</p> : null}

        <section className="mt-8 rounded-xl border border-border px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-medium text-foreground">
              <Trans>Chat apps</Trans>
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-[12px] text-muted-foreground hover:text-foreground"
              onClick={() => setShowSlackGuide((prev) => !prev)}
            >
              <InfoIcon size={14} className="mr-1.5" />
              {showSlackGuide ? (
                <Trans>Hide Slack Setup Guide</Trans>
              ) : (
                <Trans>Slack Setup Guide</Trans>
              )}
            </Button>
          </div>

          {status ? (
            <p className="mt-2 text-[13px] text-muted-foreground/70">
              {status.providers.map(providerLabel).join(" · ")}
            </p>
          ) : null}

          {showSlackGuide || status?.identities.length === 0 ? (
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-[13px] text-foreground/80">
              <h4 className="font-medium text-foreground">
                <Trans>Slack Setup & Connection Details</Trans>
              </h4>
              <p className="text-[12.5px] text-muted-foreground">
                <Trans>
                  Each bot needs its own Slack App. Create one Slack App per bot in api.slack.com/apps,
                  then add its Bot Token and Signing Secret below.
                </Trans>
              </p>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">
                  <Trans>Per-bot Event Subscriptions Request URL:</Trans>
                </label>
                <p className="text-[12px] text-muted-foreground">
                  <Trans>
                    Use the URL that matches the bot you are configuring. The bot ID is shown in the
                    credentials list below.
                  </Trans>
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded border border-border bg-background px-2.5 py-1.5 font-mono text-[12px] text-foreground">
                    {slackWebhookUrl}/{"<botId>"}
                  </code>
                  <Button variant="secondary" size="sm" onClick={copyWebhook}>
                    {copiedWebhook ? (
                      <CheckIcon size={14} className="text-emerald-500" />
                    ) : (
                      <CopyIcon size={14} />
                    )}
                    <span className="ml-1.5">
                      {copiedWebhook ? <Trans>Copied</Trans> : <Trans>Copy</Trans>}
                    </span>
                  </Button>
                </div>
                {credentials.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {credentials.map((cred) => {
                      const bot = bots.find((candidate) => candidate.id === cred.botId);
                      return (
                        <li key={cred.id} className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                          <span>{bot?.name ?? cred.botId}:</span>
                          <code className="flex-1 overflow-x-auto rounded border border-border bg-background px-2 py-0.5">
                            {slackWebhookUrl}/{cred.botId}
                          </code>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                <div className="rounded border border-border bg-background/50 p-2.5">
                  <p className="mb-1 text-[12px] font-medium text-foreground">
                    <Trans>Bot Event Subscriptions:</Trans>
                  </p>
                  <ul className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
                    <li>• app_mention</li>
                    <li>• message.channels</li>
                    <li>• message.groups</li>
                    <li>• message.im</li>
                    <li>• message.mpim</li>
                  </ul>
                </div>
                <div className="rounded border border-border bg-background/50 p-2.5">
                  <p className="mb-1 text-[12px] font-medium text-foreground">
                    <Trans>Bot Token Scopes:</Trans>
                  </p>
                  <ul className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
                    <li>• chat:write</li>
                    <li>• channels:history, groups:history</li>
                    <li>• im:history, mpim:history</li>
                    <li>• users:read, app_mentions:read</li>
                  </ul>
                </div>
              </div>

              <div className="rounded border border-border bg-background/60 p-3 text-[12px]">
                <p className="mb-1 font-medium text-foreground">
                  <Trans>How to Link Multiple Bots to Slack:</Trans>
                </p>
                <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
                  <li>
                    <Trans>
                      Add Slack App credentials (Bot Token + Signing Secret) for the bot in the
                      "Slack App Credentials" section below.
                    </Trans>
                  </li>
                  <li>
                    <Trans>
                      Create a Slack App in api.slack.com/apps for that bot and paste the matching
                      per-bot webhook URL into Event Subscriptions.
                    </Trans>
                  </li>
                  <li>
                    <Trans>
                      Select the bot from the dropdown and click "Link a chat app" to issue a
                      verification code.
                    </Trans>
                  </li>
                  <li>
                    <Trans>
                      Send the code to the bot in Slack. Repeat for additional bots.
                    </Trans>
                  </li>
                </ol>
              </div>
            </div>
          ) : null}

          {status?.identities.length ? (
            <div className="mt-4">
              <p className="mb-2 text-[12.5px] font-medium text-muted-foreground">
                <Trans>Linked Slack & Chat App Lines:</Trans>
              </p>
              <ul className="space-y-3">
                {status.identities.map((identity) => (
                  <li
                    key={identity.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-3.5 py-2.5 text-[14px] text-foreground/80"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium">
                        {providerLabel(identity.provider)} · {identity.address}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-muted-foreground">→</span>
                      <NativeSelect
                        aria-label={t`Assigned bot for ${identity.address}`}
                        value={identity.botId}
                        onChange={(e) => {
                          const newBotId = e.target.value;
                          if (newBotId && newBotId !== identity.botId) {
                            void act(() =>
                              rpc.messaging.identities.setBot({
                                identityId: identity.id,
                                botId: newBotId,
                              }),
                            );
                          }
                        }}
                      >
                        {bots.map((bot) => (
                          <NativeSelectOption key={bot.id} value={bot.id}>
                            {bot.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>

                      <Button
                        variant="secondary"
                        className="rounded-full"
                        onClick={() =>
                          void act(() =>
                            rpc.messaging.identities.unlink({ identityId: identity.id }),
                          )
                        }
                      >
                        <Trans>Unlink</Trans>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-border px-4 py-4">
            <h3 className="text-[15px] font-medium text-foreground">
              <Trans>Slack App Credentials</Trans>
            </h3>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              <Trans>
                Each bot needs its own Slack App credentials to receive messages. Create a Slack App in
                api.slack.com/apps and paste the Bot Token and Signing Secret here.
              </Trans>
            </p>

            {credentials.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {credentials.map((cred) => {
                  const bot = bots.find((candidate) => candidate.id === cred.botId);
                  const isEditing = credForm.editingId === cred.id;
                  return (
                    <li
                      key={cred.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-3.5 py-2.5 text-[14px] text-foreground/80"
                    >
                      {isEditing ? (
                        <div className="flex-1 space-y-2">
                          <Field>
                            <FieldLabel htmlFor={`cred-bot-${cred.id}`}>
                              <Trans>Bot</Trans>
                            </FieldLabel>
                            <NativeSelect
                              id={`cred-bot-${cred.id}`}
                              value={credForm.botId}
                              disabled
                              onChange={(e) =>
                                setCredForm((prev) => ({ ...prev, botId: e.target.value }))
                              }
                            >
                              {bots.map((bot) => (
                                <NativeSelectOption key={bot.id} value={bot.id}>
                                  {bot.name}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={`cred-secret-${cred.id}`}>
                              <Trans>Signing Secret</Trans>
                            </FieldLabel>
                            <Input
                              id={`cred-secret-${cred.id}`}
                              type="text"
                              autoComplete="off"
                              value={credForm.signingSecret}
                              onChange={(e) =>
                                setCredForm((prev) => ({ ...prev, signingSecret: e.target.value }))
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={`cred-token-${cred.id}`}>
                              <Trans>Bot Token</Trans>
                            </FieldLabel>
                            <Input
                              id={`cred-token-${cred.id}`}
                              type="text"
                              autoComplete="off"
                              value={credForm.botToken}
                              onChange={(e) =>
                                setCredForm((prev) => ({ ...prev, botToken: e.target.value }))
                              }
                            />
                          </Field>
                          <div className="flex gap-2">
                            <Button
                              className="rounded-full"
                              disabled={credPending}
                              onClick={submitCredential}
                            >
                              {credPending ? <Trans>Saving…</Trans> : <Trans>Save</Trans>}
                            </Button>
                            <Button
                              variant="secondary"
                              className="rounded-full"
                              onClick={resetCredForm}
                            >
                              <Trans>Cancel</Trans>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0">
                            <span className="font-medium">
                              {bot?.name ?? t`Unknown bot`}
                            </span>
                            <span className="ml-2 text-[12px] text-muted-foreground">
                              {providerLabel(cred.provider)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              className="rounded-full"
                              onClick={() => startEditCredential(cred)}
                            >
                              <Trans>Edit</Trans>
                            </Button>
                            <Button
                              variant="secondary"
                              className="rounded-full"
                              onClick={() => removeCredential(cred.id)}
                            >
                              <Trans>Remove</Trans>
                            </Button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {!credForm.editingId ? (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="cred-bot-select">
                      <Trans>Bot</Trans>
                    </FieldLabel>
                    <NativeSelect
                      id="cred-bot-select"
                      value={credForm.botId}
                      onChange={(e) =>
                        setCredForm((prev) => ({ ...prev, botId: e.target.value }))
                      }
                    >
                      <NativeSelectOption value="">{t`Choose a bot…`}</NativeSelectOption>
                      {bots.map((bot) => (
                        <NativeSelectOption key={bot.id} value={bot.id}>
                          {bot.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="cred-signing-secret">
                      <Trans>Signing Secret</Trans>
                    </FieldLabel>
                    <Input
                      id="cred-signing-secret"
                      type="text"
                      autoComplete="off"
                      placeholder={t`from your Slack App settings`}
                      value={credForm.signingSecret}
                      onChange={(e) =>
                        setCredForm((prev) => ({ ...prev, signingSecret: e.target.value }))
                      }
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="cred-bot-token">
                    <Trans>Bot Token</Trans>
                  </FieldLabel>
                  <Input
                    id="cred-bot-token"
                    type="text"
                    autoComplete="off"
                    placeholder="xoxb-..."
                    value={credForm.botToken}
                    onChange={(e) =>
                      setCredForm((prev) => ({ ...prev, botToken: e.target.value }))
                    }
                  />
                </Field>
                <Button
                  className="rounded-full"
                  disabled={!credForm.botId || !credForm.signingSecret || !credForm.botToken}
                  onClick={submitCredential}
                >
                  <Trans>Add Slack Credentials</Trans>
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            <NativeSelect
              aria-label={t`Bot to link`}
              value={linkBotId}
              onChange={(event) => {
                setLinkBotId(event.target.value);
                setLinkCode(null);
              }}
            >
              <NativeSelectOption value="">{t`Choose a bot…`}</NativeSelectOption>
              {bots.map((bot) => (
                <NativeSelectOption key={bot.id} value={bot.id}>
                  {bot.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              className="rounded-full"
              disabled={!linkBotId || linkedBotIds.has(linkBotId)}
              onClick={() =>
                void act(async () => {
                  const issued = await rpc.messaging.link.start({ botId: linkBotId });
                  setLinkCode(issued.code);
                })
              }
            >
              <Trans>Link a chat app</Trans>
            </Button>
          </div>
          {linkCode ? (
            <div
              className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-[14px] text-foreground/80"
              data-testid="messaging-link-code"
            >
              <p className="font-medium text-foreground">
                <Trans>Verification Code Issued:</Trans>
              </p>
              <div className="my-2 flex items-center gap-2">
                <span className="rounded border border-border bg-background px-3 py-1 font-mono text-base font-bold text-foreground">
                  {linkCode}
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground">
                <Trans>
                  Send <span className="font-mono font-medium text-foreground">{linkCode}</span> to the
                  line from your chat app within 10 minutes. It will be linked to{" "}
                  <strong>{bots.find((b) => b.id === linkBotId)?.name ?? "the selected bot"}</strong>. You'll get a confirmation reply once linked.
                </Trans>
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-5 rounded-xl border border-border px-4 py-4">
          <h3 className="text-[15px] font-medium text-foreground">
            <Trans>Channels</Trans>
          </h3>
          {channels.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted-foreground/70">
              <Trans>No group chats yet.</Trans>
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {channels.map((channel) => (
                <li
                  key={channel.id}
                  className="flex items-center justify-between gap-3 text-[14px] text-foreground/75"
                >
                  <span>
                    {channel.name ?? t`Group`}{" "}
                    <span className="text-[12px] text-muted-foreground/70">
                      {channelMeta(channel)}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    {channel.status === "invited" ? (
                      <>
                        <Button
                          className="rounded-full"
                          onClick={() =>
                            void act(() =>
                              rpc.messaging.channels.respond({
                                membershipId: channel.id,
                                accept: true,
                              }),
                            )
                          }
                        >
                          <Trans>Approve</Trans>
                        </Button>
                        <Button
                          variant="secondary"
                          className="rounded-full"
                          onClick={() =>
                            void act(() =>
                              rpc.messaging.channels.respond({
                                membershipId: channel.id,
                                accept: false,
                              }),
                            )
                          }
                        >
                          <Trans>Decline</Trans>
                        </Button>
                      </>
                    ) : null}
                    {channel.status === "approved" ? (
                      <Button
                        variant="secondary"
                        className="rounded-full"
                        onClick={() =>
                          void act(() => rpc.messaging.channels.leave({ membershipId: channel.id }))
                        }
                      >
                        <Trans>Leave</Trans>
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5 rounded-xl border border-border px-4 py-4">
          <h3 className="text-[15px] font-medium text-foreground">
            <Trans>Agent connections</Trans>
          </h3>
          {connections.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted-foreground/70">
              <Trans>No agent connections yet.</Trans>
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {connections.map((connection) => (
                <li
                  key={connection.id}
                  className="flex items-center justify-between gap-3 text-[14px] text-foreground/75"
                >
                  <span>
                    {connection.peerOwnerLabel}
                    {"'s "}
                    {connection.peerBotName}{" "}
                    <span className="text-[12px] text-muted-foreground/70">
                      {connection.status}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    {connection.status === "pending" && connection.incoming ? (
                      <>
                        <Button
                          className="rounded-full"
                          onClick={() =>
                            void act(() =>
                              rpc.messaging.connections.respond({
                                connectionId: connection.id,
                                accept: true,
                              }),
                            )
                          }
                        >
                          <Trans>Approve</Trans>
                        </Button>
                        <Button
                          variant="secondary"
                          className="rounded-full"
                          onClick={() =>
                            void act(() =>
                              rpc.messaging.connections.respond({
                                connectionId: connection.id,
                                accept: false,
                              }),
                            )
                          }
                        >
                          <Trans>Decline</Trans>
                        </Button>
                      </>
                    ) : null}
                    {connection.status === "approved" ? (
                      <Button
                        variant="secondary"
                        className="rounded-full"
                        onClick={() =>
                          void act(() =>
                            rpc.messaging.connections.revoke({ connectionId: connection.id }),
                          )
                        }
                      >
                        <Trans>Revoke</Trans>
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5 rounded-xl border border-border px-4 py-4">
          <h3 className="text-[15px] font-medium text-foreground">
            <Trans>Team conversations</Trans>
          </h3>
          {externalConversations.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted-foreground/70">
              <Trans>No team conversations yet.</Trans>
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {externalConversations.map((conversation) => {
                const bot = bots.find((candidate) => candidate.id === conversation.botId);
                const open = settingsConversationId === conversation.id;
                return (
                  <li key={conversation.id} className="text-[14px] text-foreground/75">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {conversation.displayName || t`External conversation`}
                        <span className="ml-2 text-[12px] text-muted-foreground/70">
                          {providerLabel(conversation.provider)}
                        </span>
                      </span>
                      <Button
                        variant="secondary"
                        className="rounded-full"
                        onClick={() => setSettingsConversationId(open ? null : conversation.id)}
                      >
                        {open ? <Trans>Close</Trans> : <Trans>Settings</Trans>}
                      </Button>
                    </div>
                    {open && bot ? (
                      <div className="mt-4 rounded-lg border border-border px-3 py-3">
                        <ExternalConversationSettings
                          conversation={conversation}
                          bot={bot}
                          onSave={async (policy) => {
                            await rpc.externalConversations.updatePolicy({
                              externalConversationId: conversation.id,
                              ...policy,
                            });
                            await refresh();
                          }}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
