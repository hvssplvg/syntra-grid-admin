"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bell, CheckCheck, Loader2, Trash2 } from "lucide-react";

import { isAdminTab, type AdminTab } from "../adminNav";
import {
  dismissNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "./api";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
}

type FilterValue = "all" | "unread" | "read";

export default function NotificationsWorkspace({
  onBack,
  onOpenMessagesConversation,
  onNavigateTab,
}: {
  onBack: () => void;
  onOpenMessagesConversation: (conversationId: string | null) => void;
  onNavigateTab: (tab: AdminTab) => void;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback((activeFilter: FilterValue) => {
    setStatus("loading");
    fetchNotifications({ limit: 30, filter: activeFilter === "unread" ? "unread" : "all" })
      .then(({ items: result, nextCursor: cursor }) => {
        setItems(activeFilter === "read" ? result.filter((item) => item.read) : result);
        setNextCursor(activeFilter === "read" ? null : cursor);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(filter);
  }, [filter, load]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchNotifications({ limit: 30, cursor: nextCursor, filter: filter === "unread" ? "unread" : "all" })
      .then(({ items: older, nextCursor: cursor }) => {
        setItems((current) => [...current, ...older]);
        setNextCursor(cursor);
      })
      .finally(() => setLoadingMore(false));
  }, [nextCursor, loadingMore, filter]);

  const markOneRead = useCallback((id: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
    void markNotificationRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    void markAllNotificationsRead().catch(() => {});
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    void dismissNotification(id).catch(() => {});
  }, []);

  const openItem = useCallback(
    (item: NotificationItem) => {
      markOneRead(item.id);

      if (item.type === "MESSAGE_RECEIVED") {
        onOpenMessagesConversation(item.entityId);
        return;
      }

      if (isAdminTab(item.module)) onNavigateTab(item.module);
    },
    [markOneRead, onOpenMessagesConversation, onNavigateTab],
  );

  return (
    <div className="flex h-full min-h-[calc(100vh-56px)] w-full flex-col bg-[var(--surface)]">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={15} />
          Back to Command Overview
        </button>

        <button
          type="button"
          onClick={markAllRead}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
        >
          <CheckCheck size={14} />
          Mark all read
        </button>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-[18px] font-semibold text-[var(--text)]">Notifications</h1>

        <div className="mt-4 flex gap-1 rounded-lg bg-[var(--surface-muted)] p-1" style={{ width: "fit-content" }}>
          {(["all", "unread", "read"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cx(
                "rounded-md px-3 py-1.5 text-[12px] font-medium capitalize",
                filter === value ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)]",
              )}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          {status === "loading" ? (
            <div className="flex justify-center py-10">
              <Loader2 size={18} className="animate-spin text-[var(--text-subtle)]" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Bell size={22} className="text-[var(--text-subtle)]" />
              <p className="text-[13px] font-semibold text-[var(--text)]">Nothing here</p>
              <p className="text-[12px] text-[var(--text-muted)]">
                {filter === "unread" ? "You're all caught up." : "No notifications yet."}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={cx(
                  "group flex items-start gap-3 rounded-xl border border-[var(--line)] px-4 py-3 transition-colors",
                  item.read ? "bg-[var(--surface)]" : "bg-[var(--accent-tint)]/40",
                )}
              >
                <button type="button" onClick={() => openItem(item)} className="flex min-w-0 flex-1 gap-3 text-left">
                  <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-[var(--accent)]")} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className={cx("text-[13px]", item.read ? "font-medium text-[var(--text-muted)]" : "font-semibold text-[var(--text)]")}>
                        {item.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-[var(--text-subtle)]">{formatTimestamp(item.createdAt)}</span>
                    </div>

                    {item.body && <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">{item.body}</p>}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="Dismiss"
                  title="Dismiss"
                  className="shrink-0 rounded-full p-1.5 text-[var(--text-subtle)] opacity-0 transition-opacity hover:bg-[var(--surface-muted)] hover:text-[var(--text)] group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}

          {nextCursor && (
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full border border-[var(--line)] px-4 py-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
