"use client";

// Reusable brand-icon renderer for the Social Media Management System.
// Replaces the old plain-text platform abbreviations ("IG", "FB", "TT"...)
// with real vector brand marks, sourced from maintained icon libraries
// (simple-icons via react-icons/si, and Font Awesome's brand set via
// react-icons/fa6 for LinkedIn — simple-icons dropped LinkedIn's logo a
// while back over a trademark request, so it isn't available there).
// Nothing is fetched at runtime: every icon is a bundled SVG component.

import type { CSSProperties } from "react";
import { SiFacebook, SiInstagram, SiTiktok, SiX, SiYoutube } from "react-icons/si";
import { FaLinkedin } from "react-icons/fa6";
import type { IconType } from "react-icons";

export type SocialPlatformId = "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "X" | "TIKTOK" | "YOUTUBE";

type Brand = {
  label: string;
  Icon: IconType;
  /** Flat brand colour, used when no explicit `color` prop is supplied. */
  color: string;
};

const BRANDS: Record<SocialPlatformId, Brand> = {
  INSTAGRAM: { label: "Instagram", Icon: SiInstagram, color: "#D6246E" },
  FACEBOOK: { label: "Facebook", Icon: SiFacebook, color: "#1877F2" },
  LINKEDIN: { label: "LinkedIn", Icon: FaLinkedin, color: "#0A66C2" },
  X: { label: "X", Icon: SiX, color: "currentColor" },
  TIKTOK: { label: "TikTok", Icon: SiTiktok, color: "#000000" },
  YOUTUBE: { label: "YouTube", Icon: SiYoutube, color: "#FF0000" },
};

/** Instagram's recognisable multi-stop gradient, applied as an SVG fill.
 *  react-icons has no slot for custom `<defs>` inside its generated icon
 *  tree, so the gradient is defined once here and referenced by id —
 *  duplicate ids across multiple rendered instances are harmless (the
 *  browser resolves `url(#id)` to the first match) and this avoids
 *  mounting a separate shared-defs component everywhere this is used. */
const INSTAGRAM_GRADIENT_ID = "sg-social-instagram-gradient";

function InstagramGradientDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        <linearGradient id={INSTAGRAM_GRADIENT_ID} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FEDA75" />
          <stop offset="25%" stopColor="#FA7E1E" />
          <stop offset="50%" stopColor="#D62976" />
          <stop offset="75%" stopColor="#962FBF" />
          <stop offset="100%" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export type SocialPlatformIconProps = {
  platform: SocialPlatformId;
  /** Pixel size of the glyph itself (not a wrapping badge). Default 16. */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Overrides the brand's default colour when variant="brand". Ignored
   *  for Instagram, which always renders its gradient. */
  color?: string;
  /** "brand" (default): the platform's real colour/gradient.
   *  "mono": renders with `fill: currentColor`, so it inherits whatever
   *  text colour the surrounding element sets — for dense or muted
   *  contexts where six different brand colours would be too busy. */
  variant?: "brand" | "mono";
  /** When provided, the icon is announced to assistive tech with this
   *  text (role="img" + aria-label) instead of being aria-hidden. Pass
   *  this only when the icon is the sole indicator of the platform —
   *  skip it when adjacent visible or sr-only text already names it
   *  (e.g. inside PlatformMark, which is paired with a visible label). */
  label?: string;
};

export function SocialPlatformIcon({
  platform,
  size = 16,
  className,
  style,
  color,
  variant = "brand",
  label,
}: SocialPlatformIconProps) {
  const brand = BRANDS[platform];
  const Icon = brand.Icon;

  const isInstagramBrand = platform === "INSTAGRAM" && variant === "brand";
  const fill = variant === "mono" ? "currentColor" : isInstagramBrand ? `url(#${INSTAGRAM_GRADIENT_ID})` : color ?? brand.color;

  const a11yProps = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };

  return (
    <>
      {isInstagramBrand && <InstagramGradientDefs />}
      <Icon size={size} fill={fill} className={className} style={style} {...a11yProps} />
    </>
  );
}

export function socialPlatformLabel(platform: SocialPlatformId): string {
  return BRANDS[platform].label;
}
