import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from '@/lib/auth/current-admin';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();

    const [departments, hiringManagers] = await Promise.all([
      prisma.department.findMany({
        where: {
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          code: true,
          colour: true,
        },
        orderBy: [
          {
            displayOrder: "asc",
          },
          {
            name: "asc",
          },
        ],
      }),

      prisma.adminUser.findMany({
        where: {
          active: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          avatarUrl: true,
          departmentId: true,
        },
        orderBy: [
          {
            firstName: "asc",
          },
          {
            lastName: "asc",
          },
          {
            email: "asc",
          },
        ],
      }),
    ]);

    return NextResponse.json({
      departments,
      hiringManagers,
      employmentTypes: [
        "FULL_TIME",
        "PART_TIME",
        "CONTRACTOR",
        "INTERN",
        "TEMPORARY",
      ],
      workArrangements: ["REMOTE", "HYBRID", "ONSITE"],
      currencies: ["NGN", "GBP", "USD", "EUR"],
      jobStatuses: [
        "DRAFT",
        "OPEN",
        "PAUSED",
        "CLOSED",
        "FILLED",
        "CANCELLED",
      ],
      candidateSources: [
        "CAREERS_PAGE",
        "LINKEDIN",
        "INSTAGRAM",
        "REFERRAL",
        "DIRECT",
        "RECRUITER",
        "AGENCY",
        "UNIVERSITY",
        "EVENT",
        "OTHER",
      ],
      applicationStages: [
        "APPLIED",
        "SCREENING",
        "SHORTLISTED",
        "INTERVIEW",
        "ASSESSMENT",
        "FINAL_INTERVIEW",
        "OFFER",
        "HIRED",
      ],
    });
  } catch (error) {
    console.error("[RECRUITMENT_OPTIONS_GET]", error);

    return NextResponse.json(
      {
        error: "Unable to load recruitment options.",
      },
      {
        status: 500,
      },
    );
  }
}