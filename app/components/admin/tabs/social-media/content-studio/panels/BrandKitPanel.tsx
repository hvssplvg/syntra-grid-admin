"use client";

// Read-only Brand Kit preview inside the Graphic wizard — reads the
// exact same company BrandKit model lib/ai/brand.ts already uses for
// AI prompts, not a new settings system. Honestly empty when no kit
// has been created yet in Brand Assets.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { getBrandKitApi, type CompanyBrandKit } from "../api";

export function BrandKitPanel() {
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");
  const [brandKit, setBrandKit] = useState<CompanyBrandKit | null>(null);

  useEffect(() => {
    getBrandKitApi().then((result) => {
      setBrandKit(result);
      setStatus(result ? "ready" : "empty");
    });
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-1.5 text-[10.5px] text-[var(--text-subtle)]">
        <Loader2 size={11} className="animate-spin" />
        Checking your Brand Kit…
      </div>
    );
  }

  if (status === "empty" || !brandKit) {
    return (
      <p className="text-[10.5px] text-[var(--text-subtle)]">
        No company Brand Kit set up yet — create one in Brand Assets to drop your logo and colours straight onto a graphic.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10.5px] font-medium text-[var(--text-muted)]">{brandKit.name}:</span>
      {brandKit.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brandKit.logoUrl} alt="" className="h-6 w-6 rounded-md border border-[var(--line)] object-contain" />
      )}
      {[...brandKit.primaryColors, ...brandKit.secondaryColors].slice(0, 6).map((color, index) => (
        <span
          key={`${color}-${index}`}
          title={color}
          className="h-5 w-5 rounded-full border border-[var(--line)]"
          style={{ background: color }}
        />
      ))}
      {brandKit.primaryColors.length === 0 && brandKit.secondaryColors.length === 0 && !brandKit.logoUrl && (
        <span className="text-[10.5px] text-[var(--text-subtle)]">No logo or colours added to this kit yet.</span>
      )}
    </div>
  );
}
