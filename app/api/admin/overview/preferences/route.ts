import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import {
  AuthenticationError,
  AuthorisationError,
  getCurrentAdmin,
} from "@/lib/auth/current-admin";
import { isOwnWallpaperUrl } from "@/lib/cloudinary-server";

export const runtime = "nodejs";

/* ============================================================================
   KNOWN SHAPE

   Mirrors app/components/admin/tabs/OverviewTab.tsx's DashboardPreferences.
   Kept here only for validation — the client owns the authoritative type.
============================================================================ */

const WIDGET_KEYS = [
  "commandBar",
  "today",
  "away",
  "statistics",
  "analytics",
  "activity",
  "commandActivity",
  "notifications",
  "delivery",
  "attention",
  "support",
  "team",
  "finance",
] as const;

const SIZE_KEYS = ["s", "m", "l", "xl"] as const;

const WALLPAPER_TYPES = ["preset", "auto", "custom", "gradient", "solid", "mix"] as const;

const WIDGET_THEMES = ["dark", "light", "auto"] as const;

const GRADIENT_KINDS = ["linear", "radial", "mesh"] as const;

const MAX_PAYLOAD_BYTES = 60_000;

const MAX_PINNED_SHORTCUTS = 12;

/* ============================================================================
   HELPERS
============================================================================ */

function errorResponse(error: unknown) {
  console.error("[admin/overview/preferences]", error);

  if (error instanceof AuthenticationError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }

  if (error instanceof AuthorisationError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  }

  return NextResponse.json(
    { ok: false, error: "Something went wrong while saving your preferences." },
    { status: 500 },
  );
}

function isHexColour(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Sanitises an arbitrary client-supplied value into a safe subset of
 * DashboardPreferences. Unknown keys are dropped; malformed known keys are
 * dropped (never throw on one bad field — a partial save is better than a
 * refused one, mirroring the client's own defensive loadPreferences).
 */
function sanitisePreferences(input: unknown): Record<string, unknown> {
  if (!isPlainObject(input)) return {};

  const out: Record<string, unknown> = {};

  if (typeof input.wallpaperType === "string" && (WALLPAPER_TYPES as readonly string[]).includes(input.wallpaperType)) {
    out.wallpaperType = input.wallpaperType;
  }

  if (typeof input.wallpaperId === "string" && input.wallpaperId.length <= 100) {
    out.wallpaperId = input.wallpaperId;
  }

  // customWallpaper must be either null or a URL this server could have
  // uploaded — never a data: URI, never an arbitrary external URL.
  if (input.customWallpaper === null) {
    out.customWallpaper = null;
  } else if (typeof input.customWallpaper === "string" && isOwnWallpaperUrl(input.customWallpaper)) {
    out.customWallpaper = input.customWallpaper;
  }

  if (typeof input.gradientId === "string" && input.gradientId.length <= 100) {
    out.gradientId = input.gradientId;
  }

  if (isPlainObject(input.customGradient)) {
    const kind = input.customGradient.kind;
    const angle = input.customGradient.angle;
    const stops = input.customGradient.stops;

    out.customGradient = {
      kind: typeof kind === "string" && (GRADIENT_KINDS as readonly string[]).includes(kind) ? kind : "mesh",
      angle: isFiniteNumber(angle) ? clampNumber(angle, 0, 360) : 145,
      stops: Array.isArray(stops) ? stops.filter(isHexColour).slice(0, 3) : [],
    };
  }

  if (isHexColour(input.solidColor)) {
    out.solidColor = input.solidColor;
  }

  if (typeof input.widgetTheme === "string" && (WIDGET_THEMES as readonly string[]).includes(input.widgetTheme)) {
    out.widgetTheme = input.widgetTheme;
  }

  if (isFiniteNumber(input.glassOpacity)) out.glassOpacity = clampNumber(input.glassOpacity, 0, 100);
  if (isFiniteNumber(input.radius)) out.radius = clampNumber(input.radius, 0, 48);
  if (typeof input.accentId === "string" && input.accentId.length <= 50) out.accentId = input.accentId;
  if (isFiniteNumber(input.overlay)) out.overlay = clampNumber(input.overlay, 0, 100);
  if (isFiniteNumber(input.blur)) out.blur = clampNumber(input.blur, 0, 40);

  if (typeof input.grain === "boolean") out.grain = input.grain;
  if (typeof input.motion === "boolean") out.motion = input.motion;
  if (typeof input.compact === "boolean") out.compact = input.compact;
  if (typeof input.showGreeting === "boolean") out.showGreeting = input.showGreeting;
  if (typeof input.layoutTipSeen === "boolean") out.layoutTipSeen = input.layoutTipSeen;

  if (input.pinnedShortcuts === null) {
    out.pinnedShortcuts = null;
  } else if (Array.isArray(input.pinnedShortcuts)) {
    out.pinnedShortcuts = input.pinnedShortcuts
      .filter((item): item is string => typeof item === "string" && item.length <= 40)
      .slice(0, MAX_PINNED_SHORTCUTS);
  }

  if (isPlainObject(input.widgetVisibility)) {
    const visibility: Record<string, boolean> = {};
    for (const key of WIDGET_KEYS) {
      if (typeof input.widgetVisibility[key] === "boolean") {
        visibility[key] = input.widgetVisibility[key] as boolean;
      }
    }
    out.widgetVisibility = visibility;
  }

  if (isPlainObject(input.layout)) {
    const order = Array.isArray(input.layout.order)
      ? input.layout.order.filter((key): key is string => typeof key === "string" && (WIDGET_KEYS as readonly string[]).includes(key))
      : [];

    const sizes: Record<string, string> = {};
    if (isPlainObject(input.layout.sizes)) {
      for (const key of WIDGET_KEYS) {
        const value = input.layout.sizes[key];
        if (typeof value === "string" && (SIZE_KEYS as readonly string[]).includes(value)) {
          sizes[key] = value;
        }
      }
    }

    const collapsed: Record<string, boolean> = {};
    if (isPlainObject(input.layout.collapsed)) {
      for (const key of WIDGET_KEYS) {
        const value = input.layout.collapsed[key];
        if (typeof value === "boolean") {
          collapsed[key] = value;
        }
      }
    }

    out.layout = { order, sizes, collapsed };
  }

  return out;
}

/* ============================================================================
   GET /api/admin/overview/preferences
============================================================================ */

export async function GET() {
  try {
    const admin = await getCurrentAdmin();

    const row = await prisma.adminOverviewPreference.findUnique({
      where: { adminUserId: admin.id },
    });

    return NextResponse.json({
      ok: true,
      preferences: row?.preferences ?? null,
      wallpaperUrl: row?.wallpaperUrl ?? null,
      updatedAt: row?.updatedAt ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/* ============================================================================
   PATCH /api/admin/overview/preferences

   Identity always comes from the authenticated session — the client never
   supplies (and this route never reads) an adminUserId. Each admin can
   only ever read or write their own row.
============================================================================ */

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();

    const rawBody = await request.text();

    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "Preferences payload is too large." }, { status: 413 });
    }

    const body = JSON.parse(rawBody) as unknown;

    if (!isPlainObject(body)) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const sanitised = sanitisePreferences(body.preferences);

    // Denormalised convenience copy of the active wallpaper URL (also
    // inside `preferences.customWallpaper`) — lets future tooling query
    // "who has a custom wallpaper" without parsing JSON.
    const wallpaperUrl =
      sanitised.wallpaperType === "custom" && typeof sanitised.customWallpaper === "string"
        ? sanitised.customWallpaper
        : null;

    const row = await prisma.adminOverviewPreference.upsert({
      where: { adminUserId: admin.id },
      create: {
        adminUserId: admin.id,
        preferences: sanitised as Prisma.InputJsonValue,
        wallpaperUrl,
      },
      update: {
        preferences: sanitised as Prisma.InputJsonValue,
        wallpaperUrl,
      },
    });

    return NextResponse.json({
      ok: true,
      preferences: row.preferences,
      wallpaperUrl: row.wallpaperUrl,
      updatedAt: row.updatedAt,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    return errorResponse(error);
  }
}
