"use client";

// A simple paginated image grid over the existing, previously-unused
// GET /api/admin/social-media/media list endpoint — the first UI
// consumer of it. Shared between Graphic Studio's "Animate with AI"
// (picking an image to animate) and Video Studio's Image-to-Video mode
// (picking a starting frame), so the two studios never grow two
// different pickers.

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { listMediaAssetsApi, type MediaLibraryAsset } from "../api";
import { BTN_SECONDARY, cx, FOCUS } from "../../shared/styles";

const PAGE_SIZE = 24;

export function MediaLibraryPicker({
  type = "IMAGE",
  onSelect,
  onClose,
}: {
  type?: "IMAGE" | "VIDEO";
  onSelect: (asset: MediaLibraryAsset) => void;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<MediaLibraryAsset[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMediaAssetsApi(page, PAGE_SIZE, type)
      .then((result) => {
        if (cancelled) return;
        setAssets(result.assets);
        setPages(result.pagination.pages);
        setError(null);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Couldn't load your media library.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, type]);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Choose from your media library"
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="flex max-h-[80vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-popover)]">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--line)] px-4">
          <p className="text-[13px] font-semibold text-[var(--text)]">Choose from your media library</p>
          <button type="button" onClick={onClose} aria-label="Close" className={cx("flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]", FOCUS)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-[var(--text-subtle)]">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <p className="text-[12px] text-[var(--danger)]">{error}</p>
          ) : assets.length === 0 ? (
            <p className="text-[12px] leading-5 text-[var(--text-subtle)]">Nothing here yet — upload or generate an image first.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelect(asset)}
                  className={cx("group relative aspect-square overflow-hidden rounded-lg border border-[var(--line)] transition duration-150 hover:border-[var(--accent)]", FOCUS)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {pages > 1 && (
          <div className="flex shrink-0 items-center justify-center gap-2 border-t border-[var(--line)] p-2.5">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setPage((current) => Math.max(1, current - 1));
              }}
              disabled={page <= 1}
              className={cx(BTN_SECONDARY, "h-7 px-2 text-[11px]")}
            >
              Prev
            </button>
            <span className="text-[11px] text-[var(--text-subtle)] tabular-nums">
              {page} / {pages}
            </span>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setPage((current) => Math.min(pages, current + 1));
              }}
              disabled={page >= pages}
              className={cx(BTN_SECONDARY, "h-7 px-2 text-[11px]")}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
