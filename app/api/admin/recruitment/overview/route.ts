import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from '@/lib/auth/current-admin';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();

    const now = new Date();

    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );

    const endOfWeek = new Date(now);

    endOfWeek.setDate(now.getDate() + 7);

    const [
      openRoles,
      totalCandidates,
      activeApplications,
      interviewsThisWeek,
      pendingOffers,
      hiresThisMonth,
      talentPool,
      stageGroups,
      recentApplications,
      upcomingInterviews,
    ] = await Promise.all([
      prisma.jobOpening.count({
        where: {
          status: "OPEN",
        },
      }),

      prisma.candidate.count({
        where: {
          status: {
            not: "ARCHIVED",
          },
        },
      }),

      prisma.jobApplication.count({
        where: {
          status: "ACTIVE",
        },
      }),

      prisma.interview.count({
        where: {
          status: "SCHEDULED",
          scheduledAt: {
            gte: now,
            lte: endOfWeek,
          },
        },
      }),

      prisma.recruitmentOffer.count({
        where: {
          status: {
            in: [
              "APPROVAL_PENDING",
              "APPROVED",
              "SENT",
              "VIEWED",
            ],
          },
        },
      }),

      prisma.jobApplication.count({
        where: {
          status: "HIRED",
          hiredAt: {
            gte: startOfMonth,
          },
        },
      }),

      prisma.candidate.count({
        where: {
          status: "TALENT_POOL",
        },
      }),

      prisma.jobApplication.groupBy({
        by: ["stage"],
        where: {
          status: "ACTIVE",
        },
        _count: {
          _all: true,
        },
      }),

      prisma.jobApplication.findMany({
        take: 6,
        orderBy: {
          appliedAt: "desc",
        },
        select: {
          id: true,
          applicationRef: true,
          stage: true,
          status: true,
          appliedAt: true,
          rating: true,

          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              email: true,
              avatarUrl: true,
            },
          },

          jobOpening: {
            select: {
              id: true,
              jobRef: true,
              title: true,
            },
          },
        },
      }),

      prisma.interview.findMany({
        where: {
          status: "SCHEDULED",
          scheduledAt: {
            gte: now,
          },
        },
        take: 6,
        orderBy: {
          scheduledAt: "asc",
        },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          scheduledAt: true,
          durationMinutes: true,
          timezone: true,
          meetingUrl: true,
          location: true,

          application: {
            select: {
              id: true,

              candidate: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  preferredName: true,
                  avatarUrl: true,
                },
              },

              jobOpening: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const stages = [
      "APPLIED",
      "SCREENING",
      "SHORTLISTED",
      "INTERVIEW",
      "ASSESSMENT",
      "FINAL_INTERVIEW",
      "OFFER",
      "HIRED",
    ] as const;

    const pipeline = stages.map((stage) => {
      const group = stageGroups.find(
        (item) => item.stage === stage,
      );

      return {
        stage,
        count: group?._count._all ?? 0,
      };
    });

    return NextResponse.json({
      metrics: {
        openRoles,
        totalCandidates,
        activeApplications,
        interviewsThisWeek,
        pendingOffers,
        hiresThisMonth,
        talentPool,
      },

      pipeline,
      recentApplications,
      upcomingInterviews,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[RECRUITMENT_OVERVIEW_GET]", error);

    return NextResponse.json(
      {
        error: "Unable to load recruitment overview.",
      },
      {
        status: 500,
      },
    );
  }
}