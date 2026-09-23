import {
  CurrencyCode,
  EmploymentType,
  JobOpeningStatus,
  WorkArrangement,
} from "@/app/generated/prisma/client";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  requireAdmin,
  requireTeamManager,
} from '@/lib/auth/current-admin';

export const dynamic = "force-dynamic";

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function parseDate(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function parseMoney(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount;
}

function enumValue<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
): T[keyof T] | null {
  if (typeof value !== "string") {
    return null;
  }

  const values = Object.values(enumObject);

  return values.includes(value)
    ? (value as T[keyof T])
    : null;
}

async function generateJobRef() {
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const random = Math.floor(
      1000 + Math.random() * 9000,
    );

    const jobRef = `SG-JOB-${year}-${random}`;

    const existing = await prisma.jobOpening.findUnique({
      where: {
        jobRef,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return jobRef;
    }
  }

  return `SG-JOB-${year}-${Date.now()}`;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim() ?? "";

    const statusParam = searchParams.get("status");

    const departmentId =
      searchParams.get("departmentId")?.trim() ?? "";

    const employmentTypeParam =
      searchParams.get("employmentType");

    const workArrangementParam =
      searchParams.get("workArrangement");

    const status = enumValue(
      JobOpeningStatus,
      statusParam,
    );

    const employmentType = enumValue(
      EmploymentType,
      employmentTypeParam,
    );

    const workArrangement = enumValue(
      WorkArrangement,
      workArrangementParam,
    );

    const jobs = await prisma.jobOpening.findMany({
      where: {
        ...(q
          ? {
              OR: [
                {
                  title: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
                {
                  jobRef: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),

        ...(status
          ? {
              status,
            }
          : {}),

        ...(departmentId
          ? {
              departmentId,
            }
          : {}),

        ...(employmentType
          ? {
              employmentType,
            }
          : {}),

        ...(workArrangement
          ? {
              workArrangement,
            }
          : {}),
      },

      orderBy: [
        {
          createdAt: "desc",
        },
      ],

      select: {
        id: true,
        jobRef: true,
        title: true,

        description: true,

        employmentType: true,
        workArrangement: true,

        country: true,
        city: true,

        salaryMin: true,
        salaryMax: true,
        currency: true,

        vacancies: true,
        status: true,

        openedAt: true,
        closesAt: true,
        targetStartDate: true,

        published: true,
        publishedAt: true,

        createdAt: true,
        updatedAt: true,

        department: {
          select: {
            id: true,
            name: true,
            code: true,
            colour: true,
          },
        },

        hiringManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },

        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    const data = jobs.map((job) => ({
      ...job,

      salaryMin: job.salaryMin?.toString() ?? null,
      salaryMax: job.salaryMax?.toString() ?? null,

      applicationCount: job._count.applications,
    }));

    return NextResponse.json({
      jobs: data,
      count: data.length,
    });
  } catch (error) {
    console.error("[RECRUITMENT_JOBS_GET]", error);

    return NextResponse.json(
      {
        error: "Unable to load job openings.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireTeamManager();

    const body = await request.json();

    const title = cleanString(body.title);

    if (!title) {
      return NextResponse.json(
        {
          error: "Job title is required.",
        },
        {
          status: 400,
        },
      );
    }

    const employmentType = enumValue(
      EmploymentType,
      body.employmentType,
    );

    if (!employmentType) {
      return NextResponse.json(
        {
          error: "A valid employment type is required.",
        },
        {
          status: 400,
        },
      );
    }

    const workArrangement = body.workArrangement
      ? enumValue(
          WorkArrangement,
          body.workArrangement,
        )
      : null;

    if (
      body.workArrangement &&
      !workArrangement
    ) {
      return NextResponse.json(
        {
          error: "Invalid work arrangement.",
        },
        {
          status: 400,
        },
      );
    }

    const status =
      enumValue(
        JobOpeningStatus,
        body.status,
      ) ?? JobOpeningStatus.DRAFT;

    const currency = body.currency
      ? enumValue(
          CurrencyCode,
          body.currency,
        )
      : null;

    if (body.currency && !currency) {
      return NextResponse.json(
        {
          error: "Invalid currency.",
        },
        {
          status: 400,
        },
      );
    }

    const salaryMin = parseMoney(body.salaryMin);
    const salaryMax = parseMoney(body.salaryMax);

    if (
      salaryMin !== null &&
      salaryMax !== null &&
      salaryMax < salaryMin
    ) {
      return NextResponse.json(
        {
          error:
            "Maximum salary cannot be lower than minimum salary.",
        },
        {
          status: 400,
        },
      );
    }

    const vacanciesRaw = Number(
      body.vacancies ?? 1,
    );

    if (
      !Number.isInteger(vacanciesRaw) ||
      vacanciesRaw < 1
    ) {
      return NextResponse.json(
        {
          error:
            "Vacancies must be a whole number of at least 1.",
        },
        {
          status: 400,
        },
      );
    }

    const departmentId = cleanString(
      body.departmentId,
    );

    if (departmentId) {
      const department =
        await prisma.department.findUnique({
          where: {
            id: departmentId,
          },
          select: {
            id: true,
            status: true,
          },
        });

      if (
        !department ||
        department.status !== "ACTIVE"
      ) {
        return NextResponse.json(
          {
            error:
              "The selected department is not available.",
          },
          {
            status: 400,
          },
        );
      }
    }

    const hiringManagerId = cleanString(
      body.hiringManagerId,
    );

    if (hiringManagerId) {
      const manager =
        await prisma.adminUser.findUnique({
          where: {
            id: hiringManagerId,
          },
          select: {
            id: true,
            active: true,
          },
        });

      if (!manager?.active) {
        return NextResponse.json(
          {
            error:
              "The selected hiring manager is not available.",
          },
          {
            status: 400,
          },
        );
      }
    }

    const openedAt = parseDate(body.openedAt);
    const closesAt = parseDate(body.closesAt);

    if (
      openedAt &&
      closesAt &&
      closesAt < openedAt
    ) {
      return NextResponse.json(
        {
          error:
            "Closing date cannot be earlier than opening date.",
        },
        {
          status: 400,
        },
      );
    }

    const published = Boolean(body.published);

    const jobRef = await generateJobRef();

    const job = await prisma.jobOpening.create({
      data: {
        jobRef,
        title,

        departmentId,

        description: cleanString(
          body.description,
        ),

        responsibilities: cleanString(
          body.responsibilities,
        ),

        requirements: cleanString(
          body.requirements,
        ),

        benefits: cleanString(
          body.benefits,
        ),

        employmentType,
        workArrangement,

        country: cleanString(body.country),
        city: cleanString(body.city),

        salaryMin,
        salaryMax,
        currency,

        vacancies: vacanciesRaw,

        status,

        openedAt:
          openedAt ??
          (status === JobOpeningStatus.OPEN
            ? new Date()
            : null),

        closesAt,

        targetStartDate: parseDate(
          body.targetStartDate,
        ),

        hiringManagerId,

        published,

        publishedAt: published
          ? new Date()
          : null,
      },

      select: {
        id: true,
        jobRef: true,
        title: true,

        description: true,
        responsibilities: true,
        requirements: true,
        benefits: true,

        employmentType: true,
        workArrangement: true,

        country: true,
        city: true,

        salaryMin: true,
        salaryMax: true,
        currency: true,

        vacancies: true,
        status: true,

        openedAt: true,
        closesAt: true,
        targetStartDate: true,

        published: true,
        publishedAt: true,

        createdAt: true,
        updatedAt: true,

        department: {
          select: {
            id: true,
            name: true,
            code: true,
            colour: true,
          },
        },

        hiringManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        job: {
          ...job,

          salaryMin:
            job.salaryMin?.toString() ?? null,

          salaryMax:
            job.salaryMax?.toString() ?? null,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("[RECRUITMENT_JOBS_POST]", error);

    return NextResponse.json(
      {
        error: "Unable to create job opening.",
      },
      {
        status: 500,
      },
    );
  }
}