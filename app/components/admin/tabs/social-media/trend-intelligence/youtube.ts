// Pure, client-safe YouTube URL helpers — no React, no server-only
// imports, so these are trivially unit-testable and usable from both
// the embed component and any card/list that needs a thumbnail.

const ID_PATTERN = /^[\w-]{11}$/;

/** Extracts an 11-char YouTube video id from watch/shorts/youtu.be/
 *  embed URLs. Returns null for anything else — including every
 *  non-YouTube trend's sourceUrl, which this is always safe to call
 *  on. */
export function extractYoutubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return ID_PATTERN.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.pathname === "/watch") {
      const id = parsed.searchParams.get("v");
      return id && ID_PATTERN.test(id) ? id : null;
    }
    const shortsMatch = /^\/shorts\/([\w-]{11})/.exec(parsed.pathname);
    if (shortsMatch) return shortsMatch[1];
    const embedMatch = /^\/embed\/([\w-]{11})/.exec(parsed.pathname);
    if (embedMatch) return embedMatch[1];
  }

  return null;
}

export function youtubeThumbnailUrl(videoId: string, size: "hqdefault" | "maxresdefault" = "hqdefault"): string {
  return `https://img.youtube.com/vi/${videoId}/${size}.jpg`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
