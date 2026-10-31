/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// The real, playable YouTube video for an auto-discovered trend — a
// lite-embed (thumbnail first, iframe only once tapped) so a swipe
// card full of trends never autoplays or loads a dozen iframes at
// once. Never downloads/rehosts anything — always the official
// youtube-nocookie.com iframe player, with an "Open on YouTube"
// fallback shown in every state.

import { useEffect, useState } from "react";
import { ExternalLink, Play } from "lucide-react";

import { cx, FOCUS } from "../shared/styles";
import { checkYoutubeEmbedApi } from "./api";
import { youtubeEmbedUrl, youtubeThumbnailUrl, youtubeWatchUrl } from "./youtube";

type EmbedCheck = "pending" | "embeddable" | "not-embeddable" | "error";

export function YoutubeEmbed({
  videoId,
  title,
  variant = "full",
  className,
}: {
  videoId: string;
  title: string;
  /** "full" — detail modal / preview pane. "compact" — the swipe card,
   *  smaller chrome, same mechanics. */
  variant?: "full" | "compact";
  className?: string;
}) {
  const [check, setCheck] = useState<EmbedCheck>("pending");
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [thumbnailFallback, setThumbnailFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCheck("pending");
    setAuthorName(null);
    setPlaying(false);
    setThumbnailFallback(false);
    checkYoutubeEmbedApi(videoId)
      .then((result) => {
        if (cancelled) return;
        setCheck(result.embeddable ? "embeddable" : "not-embeddable");
        if (result.embeddable) setAuthorName(result.authorName);
      })
      .catch(() => {
        if (!cancelled) setCheck("error");
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const blocked = check === "not-embeddable";
  const showIframe = playing && !blocked;

  return (
    <div className={cx("overflow-hidden rounded-xl border border-[var(--line)] bg-black", className)}>
      <div className="relative w-full" style={{ aspectRatio: "9 / 16" }}>
        {showIframe ? (
          <iframe
            src={`${youtubeEmbedUrl(videoId)}?autoplay=1`}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"
            allowFullScreen
            loading="lazy"
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            onClick={() => !blocked && setPlaying(true)}
            onPointerDown={(event) => event.stopPropagation()}
            disabled={blocked}
            aria-label={blocked ? "This video can't be played here" : `Play ${title}`}
            className={cx("absolute inset-0 flex h-full w-full items-center justify-center", blocked ? "cursor-default" : "cursor-pointer")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailFallback ? `https://img.youtube.com/vi/${videoId}/0.jpg` : youtubeThumbnailUrl(videoId)}
              onError={() => setThumbnailFallback(true)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
            {blocked ? (
              <div className="relative z-10 flex flex-col items-center gap-2 px-4 text-center">
                <p className="text-[11.5px] font-medium text-white">This video can&apos;t be played here</p>
                <span className="text-[10.5px] text-white/70">Watch it on YouTube instead</span>
              </div>
            ) : (
              <span className={cx("relative z-10 flex items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition group-hover:scale-105", variant === "compact" ? "h-11 w-11" : "h-14 w-14")}>
                <Play className={variant === "compact" ? "h-5 w-5" : "h-6 w-6"} fill="currentColor" />
              </span>
            )}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 bg-black/90 px-2.5 py-1.5">
        <span className="truncate text-[10px] text-white/60">{authorName ? `${authorName} · YouTube` : "via YouTube"}</span>
        <a
          href={youtubeWatchUrl(videoId)}
          target="_blank"
          rel="noreferrer"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className={cx("inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-white/80 hover:text-white", FOCUS)}
        >
          Open on YouTube <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </div>
  );
}
