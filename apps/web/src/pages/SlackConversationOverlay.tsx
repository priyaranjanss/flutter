import { Trans, useLingui } from "@lingui/react/macro";
import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { ExternalMessage } from "@rakazo/contracts";
import { BotAvatar, Button, Dialog, DialogClose, DialogContent, DialogTitle } from "@rakazo/ui-web";
import { useEffect, useMemo, useState } from "react";
import { rpc } from "../lib/rpc";

export function SlackConversationOverlay({
  botId,
  botName,
  botColor,
  conversationId,
  displayName,
  provider,
  onClose,
}: {
  botId: string;
  botName: string;
  botColor: string;
  conversationId: string;
  displayName: string;
  provider: string;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [messages, setMessages] = useState<readonly ExternalMessage[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    setHistoryReady(false);
    setHistoryFailed(false);
    setMessages([]);
    rpc.externalConversations
      .messages({ externalConversationId: conversationId, limit: 100 })
      .then((result) => {
        if (abort.signal.aborted) return;
        setMessages(result);
        setHistoryReady(true);
      })
      .catch(() => {
        if (abort.signal.aborted) return;
        setHistoryFailed(true);
        setHistoryReady(true);
      });
    return () => {
      abort.abort();
    };
  }, [conversationId, reloadKey]);

  const title = useMemo(() => {
    const label = displayName || t`Slack conversation`;
    return `${botName} · ${label}`;
  }, [displayName, botName, t]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex h-full w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 text-foreground ring-0 sm:max-w-none"
      >
        <div className="flex items-center justify-between gap-4 border-b border-sidebar-border px-[18px] py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex items-center -space-x-2">
              <BotAvatar color={botColor} identity={botId} size={28} />
              <BotAvatar color="#85858A" identity={`${provider}-person`} size={28} />
            </div>
            <DialogTitle className="truncate text-[15.5px] font-medium text-foreground" dir="auto">
              {title}
            </DialogTitle>
          </div>
          <DialogClose aria-label={t`Close`} render={<Button variant="ghost" size="sm" />}>
            <Trans>Close</Trans>
          </DialogClose>
        </div>

        {!historyReady ? (
          <div className="grid flex-1 place-items-center px-8 text-center text-[13.5px] text-muted-foreground/80">
            <Trans>Loading…</Trans>
          </div>
        ) : historyFailed ? (
          <div className="grid flex-1 place-items-center px-8 text-center text-[13.5px] text-muted-foreground/80">
            <div className="flex flex-col items-center gap-3">
              <Trans>Could not load this chat.</Trans>
              <Button variant="outline" size="sm" onClick={() => setReloadKey((value) => value + 1)}>
                <Trans>Retry now</Trans>
              </Button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="grid flex-1 place-items-center px-8 text-center text-[13.5px] text-muted-foreground/80">
            <Trans>No messages yet.</Trans>
          </div>
        ) : (
          <div
            data-testid="slack-conversation-transcript"
            className="rk-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-5 md:px-7 md:py-6"
          >
            {messages.map((message, index) => {
              const sent = message.senderIsBot;
              return (
                <div
                  key={`${message.id}-${index}`}
                  className={`flex ${sent ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      sent ? "bg-accent" : "bg-muted"
                    }`}
                  >
                    <div className="mb-1 text-[12px] text-muted-foreground/70" dir="auto">
                      {message.senderName}
                    </div>
                    <div className="text-[14.5px] leading-[1.5] text-foreground/90" dir="auto">
                      <ChatMarkdown>{message.content}</ChatMarkdown>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-4 border-t border-sidebar-border px-[18px] py-3.5">
          <p className="text-[13.5px] text-muted-foreground/80">
            <Trans>This chat is view-only</Trans>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
