// lib/ai/platformDetection.ts
//
// Pure, dependency-free keyword matcher — deliberately NOT an AI call.
// Classifying "which platform did they mention" from a short brief
// doesn't warrant a paid request, and this file has zero server-only
// imports (no Prisma, no env, no fetch), so it's safe to import from a
// "use client" component directly (AiGenerationPanel.tsx does).
//
// Ambiguous or unmentioned platforms resolve to null ("General") rather
// than guessing — a wrong silent guess would be worse than no guess.

import type { SocialPlatform } from "@/app/components/admin/tabs/social-media/shared/types";

const PLATFORM_KEYWORDS: Array<{ platform: SocialPlatform; patterns: RegExp[] }> = [
  { platform: "LINKEDIN", patterns: [/linkedin/i] },
  { platform: "INSTAGRAM", patterns: [/instagram/i, /\binsta\b/i, /\big\b/i] },
  { platform: "FACEBOOK", patterns: [/facebook/i, /\bfb\b/i] },
  { platform: "TIKTOK", patterns: [/tik ?tok/i] },
  { platform: "YOUTUBE", patterns: [/youtube/i, /\byt\b/i] },
  // X last and most specific — "tweet"/"twitter" are unambiguous, but a
  // bare "x" is too common a word to match on its own.
  { platform: "X", patterns: [/twitter/i, /\btweet(s|ing)?\b/i, /\bx\.com\b/i, /\bon x\b/i, /\bfor x\b/i] },
];

export function detectPlatformFromBrief(text: string): SocialPlatform | null {
  if (!text.trim()) return null;

  const matches = PLATFORM_KEYWORDS.filter(({ patterns }) => patterns.some((pattern) => pattern.test(text)));

  // Exactly one platform mentioned → confident match. Zero or several
  // (genuinely ambiguous, e.g. "post this on Instagram and Facebook")
  // → General, never a guessed pick between them.
  if (matches.length === 1) return matches[0].platform;
  return null;
}
