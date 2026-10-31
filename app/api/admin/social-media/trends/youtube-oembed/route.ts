import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/social-media/trends/youtube-oembed?videoId=<id>

   Proxies YouTube's free, unauthenticated oEmbed endpoint — no API key,
   no quota. Serves two purposes for the embedded player: an
   embeddability/liveness check (YouTube returns 400/401/404 — verified
   live — when a video is malformed/nonexistent, private/embedding-
   disabled, or deleted), and a
   metadata fallback (title/channel/thumbnail) for trends that predate
   richer Data API capture or were imported manually and never went
   through it at all. Called once per mounted embed — never pre-fetched
   for off-screen rows, no server-side caching.
============================================================================ */

const ID_PATTERN = /^[\w-]{11}$/;

export async function GET(request: NextRequest) {
  try {
    await requireSocialMediaPermission(AccessAction.VIEW);

    const videoId = request.nextUrl.searchParams.get("videoId");
    if (!videoId || !ID_PATTERN.test(videoId)) {
      return NextResponse.json({ ok: false, error: "A valid videoId is required." }, { status: 400 });
    }

    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

    const response = await fetch(oembedUrl, { cache: "no-store" });

    // Verified against the live endpoint: 400 (malformed/nonexistent
    // video), 401 (private/embedding disabled), and 404 (deleted) are
    // all normal "can't play this" outcomes, not server errors.
    if (response.status === 400 || response.status === 401 || response.status === 404) {
      return NextResponse.json({ ok: true, embeddable: false });
    }
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: `YouTube oEmbed request failed (${response.status}).` }, { status: 502 });
    }

    const data: { title?: string; author_name?: string; thumbnail_url?: string } = await response.json();
    return NextResponse.json({
      ok: true,
      embeddable: true,
      title: data.title ?? null,
      authorName: data.author_name ?? null,
      thumbnailUrl: data.thumbnail_url ?? null,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    console.error("[admin/social-media/trends/youtube-oembed]", error);
    return NextResponse.json({ ok: false, error: "Couldn't reach YouTube." }, { status: 502 });
  }
}
