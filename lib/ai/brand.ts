// lib/ai/brand.ts
//
// Brand voice/context for AI prompts. Reads the real BrandKit/
// BrandGuideline models (prisma/schema.prisma) when a company-wide kit
// (BrandKit.clientId === null) has a PUBLISHED guideline — never a
// second, duplicate brand-config system. Falls back to a static,
// clearly-labelled default built verbatim from the positioning Syntra
// Grid itself specified for this feature, only when no real guideline
// exists yet. Confirmed directly (2026-10, read-only DB check) that no
// company BrandKit exists today, so the fallback is what's actually in
// effect until one is created in Brand Assets.

import { prisma } from "@/lib/prisma";
import { BrandGuidelineStatus, BrandKitStatus } from "@/app/generated/prisma/enums";

export type BrandContext = {
  company: string;
  positioning: string;
  coreValue: string;
  services: string[];
  preferredStyle: string;
  avoid: string[];
  /** Specific phrases the admin has flagged as overused AI marketing
   *  clichés — checked explicitly in the prompt, not just implied by
   *  the general `avoid` list, because generic instructions alone kept
   *  letting these through. */
  bannedPhrases: string[];
  tagline?: string;
  personality?: string;
  toneOfVoice?: string;
  socialMediaGuidelines?: string;
  /** Business personalisation (Trend Intelligence) — unset until the
   *  admin fills these in on the Brand Assets guideline form. Callers
   *  should treat an absent value as "unknown", never guess one. */
  industry?: string;
  targetAudience?: string;
  /** The same BrandKit row lib/social-media/brandKit.ts's
   *  getCompanyBrandKit() already reads for the Graphic Studio's
   *  read-only Brand Kit panel — folded into this one query so every
   *  AI prompt can reference the real logo/colours too, not just
   *  guideline text. */
  logoUrl?: string;
  primaryColors: string[];
  secondaryColors: string[];
  /** Defaults to "English" — a real field the prompt reads, never a
   *  literal hardcoded string, so multilingual support only needs this
   *  field wired to a real preference later, not a prompt rewrite. */
  preferredLanguage: string;
};

export const DEFAULT_BRAND_CONTEXT: BrandContext = {
  company: "Syntra Grid",
  positioning:
    "We design software around how a business actually operates, rather than forcing businesses into generic subscription platforms.",
  coreValue:
    "We design technology around how a business actually operates, instead of forcing the business into generic software.",
  services: [
    "Custom websites",
    "Admin dashboards",
    "Business management systems",
    "Mobile applications",
    "School management platforms",
    "Property management platforms",
    "Customer and employee portals",
    "Workflow automation",
    "Bespoke digital solutions",
  ],
  preferredStyle: "Natural, professional, specific, credible, human and confident — written for the actual audience reading it, not a generic one.",
  avoid: [
    "Generic AI marketing clichés",
    "Excessive emojis",
    "Exaggerated promises",
    "Invented clients, testimonials or case studies",
    "Fabricated project results or statistics",
    "Unsupported promises or invented achievements",
    "Repetitive hashtags",
    "Unnecessary technical jargon",
  ],
  bannedPhrases: [
    "Transform your vision into reality",
    "Thrive in the digital age",
    "Unlock your business potential",
    "Take your business to the next level",
    "Revolutionise your workflow",
  ],
  primaryColors: [],
  secondaryColors: [],
  preferredLanguage: "English",
};

/** Looks up a company-wide (non-client) BrandKit with a published
 *  guideline. Returns null if none exists yet — callers fall back to
 *  DEFAULT_BRAND_CONTEXT, they never fabricate one. */
export async function getBrandContext(): Promise<BrandContext> {
  const kit = await prisma.brandKit.findFirst({
    where: { clientId: null, status: BrandKitStatus.ACTIVE, guideline: { status: BrandGuidelineStatus.PUBLISHED } },
    select: {
      name: true,
      primaryColors: true,
      secondaryColors: true,
      logoAsset: { select: { url: true } },
      guideline: {
        select: {
          tagline: true,
          mission: true,
          personality: true,
          toneOfVoice: true,
          socialMediaGuidelines: true,
          marketingStandards: true,
          industry: true,
          targetAudience: true,
          preferredLanguage: true,
        },
      },
    },
  });

  if (!kit?.guideline) return DEFAULT_BRAND_CONTEXT;

  return {
    ...DEFAULT_BRAND_CONTEXT,
    company: kit.name || DEFAULT_BRAND_CONTEXT.company,
    positioning: kit.guideline.mission || DEFAULT_BRAND_CONTEXT.positioning,
    tagline: kit.guideline.tagline ?? undefined,
    personality: kit.guideline.personality ?? undefined,
    toneOfVoice: kit.guideline.toneOfVoice ?? undefined,
    socialMediaGuidelines: kit.guideline.socialMediaGuidelines ?? undefined,
    industry: kit.guideline.industry ?? undefined,
    targetAudience: kit.guideline.targetAudience ?? undefined,
    logoUrl: kit.logoAsset?.url ?? undefined,
    primaryColors: Array.isArray(kit.primaryColors) ? (kit.primaryColors as string[]) : [],
    secondaryColors: Array.isArray(kit.secondaryColors) ? (kit.secondaryColors as string[]) : [],
    preferredLanguage: kit.guideline.preferredLanguage || DEFAULT_BRAND_CONTEXT.preferredLanguage,
  };
}
