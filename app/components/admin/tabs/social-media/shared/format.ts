// Shared date/platform-lookup helpers used across SocialMediaTab.tsx and
// the content-studio directory. Moved verbatim from SocialMediaTab.tsx as
// part of the circular-import cleanup described in
// /Users/hvss/.claude/plans/cuddly-gathering-willow.md — no logic
// changed, only relocated.

import { PLATFORMS } from "./constants";
import type { SocialPlatform } from "./types";

export function nowMs() {
  return Date.now();
}

export function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!isValidDate(date)) return "Unknown date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (!isValidDate(date)) return "Unknown date";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const RELATIVE = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

export function relativeTime(value: string) {
  const diff = new Date(value).getTime() - nowMs();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return "just now";
  if (abs < hour) return RELATIVE.format(Math.round(diff / minute), "minute");
  if (abs < day) return RELATIVE.format(Math.round(diff / hour), "hour");
  if (abs < 7 * day) return RELATIVE.format(Math.round(diff / day), "day");
  return RELATIVE.format(Math.round(diff / (7 * day)), "week");
}

export function editedLabel(value: string) {
  const diff = Math.abs(new Date(value).getTime() - nowMs());
  return diff < 7 * 24 * 60 * 60_000
    ? `Edited ${relativeTime(value)}`
    : `Edited ${formatDate(value)}`;
}

export function platformDefinition(platform: SocialPlatform) {
  return PLATFORMS.find((item) => item.id === platform)!;
}
