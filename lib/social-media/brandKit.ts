// lib/social-media/brandKit.ts
//
// Read-only lookup of the company (non-client) BrandKit for Content
// Studio's Brand Kit panel — the same model lib/ai/brand.ts already
// reads for AI prompts. Not a new settings system: this is a second,
// narrower view (logo + colours instead of guideline text) onto the
// exact same BrandKit/BrandAsset rows.

import { prisma } from "@/lib/prisma";
import { BrandKitStatus } from "@/app/generated/prisma/enums";

export type CompanyBrandKit = {
  name: string;
  logoUrl: string | null;
  primaryColors: string[];
  secondaryColors: string[];
};

export async function getCompanyBrandKit(): Promise<CompanyBrandKit | null> {
  const kit = await prisma.brandKit.findFirst({
    where: { clientId: null, status: BrandKitStatus.ACTIVE },
    select: {
      name: true,
      primaryColors: true,
      secondaryColors: true,
      logoAsset: { select: { url: true } },
    },
  });

  if (!kit) return null;

  return {
    name: kit.name,
    logoUrl: kit.logoAsset?.url ?? null,
    primaryColors: Array.isArray(kit.primaryColors) ? (kit.primaryColors as string[]) : [],
    secondaryColors: Array.isArray(kit.secondaryColors) ? (kit.secondaryColors as string[]) : [],
  };
}
