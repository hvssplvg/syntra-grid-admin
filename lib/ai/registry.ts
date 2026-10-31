// lib/ai/registry.ts
//
// Provider registry — mirrors lib/social-media/publishing.ts's
// registerPublishAdapter()/getPublishAdapter() pattern exactly, and
// lib/social-media/accounts.ts's readEnv()/isPlatformConfigured()/
// requiredEnvVarsFor() shape, so this feature reuses the same
// architectural idiom already established in this codebase rather than
// inventing a new one.

import type { AiTextProvider } from "./types";
import type { AiImageProvider } from "./imageTypes";
import type { AiVisionProvider } from "./visionTypes";
import type { AiVideoProvider } from "./videoGenTypes";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

const PROVIDERS: Partial<Record<string, AiTextProvider>> = {};

export function registerAiTextProvider(provider: AiTextProvider) {
  PROVIDERS[provider.id] = provider;
}

function activeProviderId(): string {
  return readEnv("AI_TEXT_PROVIDER") ?? "openai";
}

/** The env vars the *currently selected* provider needs — each provider
 *  declares its own, so switching AI_TEXT_PROVIDER automatically checks
 *  the right variables without touching this file. */
export function requiredAiTextEnvVars(): string[] {
  return REQUIRED_ENV_VARS[activeProviderId()] ?? [];
}

export function isAiTextConfigured(): boolean {
  return requiredAiTextEnvVars().every((name) => Boolean(readEnv(name)));
}

export function getAiTextProvider(): AiTextProvider | null {
  return PROVIDERS[activeProviderId()] ?? null;
}

const REQUIRED_ENV_VARS: Record<string, string[]> = {
  openai: ["OPENAI_API_KEY"],
};

/* ============================================================================
   IMAGE PROVIDERS — a deliberately separate registry from the text one
   above (same shape, different maps). Mode A ("Generate Image") reuses
   the exact same OPENAI_API_KEY as text generation — this is not a new
   paid service, just a second capability on the same account/key.
============================================================================ */

const IMAGE_PROVIDERS: Partial<Record<string, AiImageProvider>> = {};

export function registerAiImageProvider(provider: AiImageProvider) {
  IMAGE_PROVIDERS[provider.id] = provider;
}

function activeImageProviderId(): string {
  return readEnv("AI_IMAGE_PROVIDER") ?? "openai";
}

export function requiredAiImageEnvVars(): string[] {
  return REQUIRED_IMAGE_ENV_VARS[activeImageProviderId()] ?? [];
}

export function isAiImageConfigured(): boolean {
  return requiredAiImageEnvVars().every((name) => Boolean(readEnv(name)));
}

export function getAiImageProvider(): AiImageProvider | null {
  return IMAGE_PROVIDERS[activeImageProviderId()] ?? null;
}

const REQUIRED_IMAGE_ENV_VARS: Record<string, string[]> = {
  openai: ["OPENAI_API_KEY"],
};

/* ============================================================================
   VISION PROVIDERS — a third, separate registry (same shape again).
   Reuses the exact same OPENAI_API_KEY as text/image generation — one
   more capability on the same account, not a new paid service.
============================================================================ */

const VISION_PROVIDERS: Partial<Record<string, AiVisionProvider>> = {};

export function registerAiVisionProvider(provider: AiVisionProvider) {
  VISION_PROVIDERS[provider.id] = provider;
}

function activeVisionProviderId(): string {
  return readEnv("AI_VISION_PROVIDER") ?? "openai";
}

export function requiredAiVisionEnvVars(): string[] {
  return REQUIRED_VISION_ENV_VARS[activeVisionProviderId()] ?? [];
}

export function isAiVisionConfigured(): boolean {
  return requiredAiVisionEnvVars().every((name) => Boolean(readEnv(name)));
}

export function getAiVisionProvider(): AiVisionProvider | null {
  return VISION_PROVIDERS[activeVisionProviderId()] ?? null;
}

const REQUIRED_VISION_ENV_VARS: Record<string, string[]> = {
  openai: ["OPENAI_API_KEY"],
};

/* ============================================================================
   VIDEO PROVIDERS — a fourth, separate registry (same shape again). This
   one is NOT the same OPENAI_API_KEY as the others — real AI video
   generation (Luma) is a genuinely new paid service, approved
   separately from the existing image/text/vision capabilities.
============================================================================ */

const VIDEO_PROVIDERS: Partial<Record<string, AiVideoProvider>> = {};

export function registerAiVideoProvider(provider: AiVideoProvider) {
  VIDEO_PROVIDERS[provider.id] = provider;
}

function activeVideoProviderId(): string {
  return readEnv("AI_VIDEO_PROVIDER") ?? "luma";
}

export function requiredAiVideoEnvVars(): string[] {
  return REQUIRED_VIDEO_ENV_VARS[activeVideoProviderId()] ?? [];
}

export function isAiVideoConfigured(): boolean {
  return requiredAiVideoEnvVars().every((name) => Boolean(readEnv(name)));
}

export function getAiVideoProvider(): AiVideoProvider | null {
  return VIDEO_PROVIDERS[activeVideoProviderId()] ?? null;
}

const REQUIRED_VIDEO_ENV_VARS: Record<string, string[]> = {
  luma: ["LUMA_API_KEY"],
};
