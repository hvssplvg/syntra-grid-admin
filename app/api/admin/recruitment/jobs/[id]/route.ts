import {
  CurrencyCode,
  EmploymentType,
  JobOpeningStatus,
  WorkArrangement,
} from "@/app/generated/prisma/client";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";
import {
  requireAdmin,
  requireTeamManager,
} from  '@/lib/auth/current-admin';

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function parseDate(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
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

  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return undefined;
  }

  return number;
}

function enumValue<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
): T[keyof T] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return Object.values(enumObject).includes(value)
    ? (value as T[keyof T])
    : undefined;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    await requireAdmin();

    const { id } = await context.params;

    const job = await prisma.jobOpening.findUnique({
      where: {
        id,
      },

      include: {
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
            role: true,
          },
        },

        applications: {
          orderBy: {
            appliedAt: "desc",
          },

          select: {
            id: true,
            applicationRef: true,
            stage: true,
            status: true,
            rating: true,
            appliedAt: true,
            stageChangedAt: true,

            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                preferredName: true,
                email: true,
                phone: true,
                avatarUrl: true,
                currentJobTitle: true,
                currentCompany: true,
                source: true,
              },
            },

            owner: {
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
                interviews: true,
                offers: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        {
          error: "Job opening not found.",
        },
        {
          status: 404,
        },
      );
    }

    const stageCounts =
      await prisma.jobApplication.groupBy({
        by: ["stage"],
        where: {
          jobOpeningId: id,
        },
        _count: {
          _all: true,
        },
      });

    return NextResponse.json({
      job: {
        ...job,

        salaryMin:
          job.salaryMin?.toString() ?? null,

        salaryMax:
          job.salaryMax?.toString() ?? null,
      },

      stageCounts: stageCounts.map(
        (item) => ({
          stage: item.stage,
          count: item._count._all,
        }),
      ),
    });
  } catch (error) {
    console.error(
      "[RECRUITMENT_JOB_GET]",
      error,
    );

    return NextResponse.json(
      {
        error: "Unable to load job opening.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    await requireTeamManager();

    const { id } = await context.params;

    const existing =
      await prisma.jobOpening.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error: "Job opening not found.",
        },
        {
          status: 404,
        },
      );
    }

    const body = await request.json();

    const data: Record<string, unknown> = {};

    if ("title" in body) {
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

      data.title = title;
    }

    if ("description" in body) {
      data.description = cleanString(
        body.description,
      );
    }

    if ("responsibilities" in body) {
      data.responsibilities = cleanString(
        body.responsibilities,
      );
    }

    if ("requirements" in body) {
      data.requirements = cleanString(
        body.requirements,
      );
    }

    if ("benefits" in body) {
      data.benefits = cleanString(
        body.benefits,
      );
    }

    if ("country" in body) {
      data.country = cleanString(body.country);
    }

    if ("city" in body) {
      data.city = cleanString(body.city);
    }

    if ("employmentType" in body) {
      const value = enumValue(
        EmploymentType,
        body.employmentType,
      );

      if (!value) {
        return NextResponse.json(
          {
            error: "Invalid employment type.",
          },
          {
            status: 400,
          },
        );
      }

      data.employmentType = value;
    }

    if ("workArrangement" in body) {
      if (!body.workArrangement) {
        data.workArrangement = null;
      } else {
        const value = enumValue(
          WorkArrangement,
          body.workArrangement,
        );

        if (!value) {
          return NextResponse.json(
            {
              error:
                "Invalid work arrangement.",
            },
            {
              status: 400,
            },
          );
        }

        data.workArrangement = value;
      }
    }

    if ("currency" in body) {
      if (!body.currency) {
        data.currency = null;
      } else {
        const value = enumValue(
          CurrencyCode,
          body.currency,
        );

        if (!value) {
          return NextResponse.json(
            {
              error: "Invalid currency.",
            },
            {
              status: 400,
            },
          );
        }

        data.currency = value;
      }
    }

    if ("salaryMin" in body) {
      const value = parseMoney(
        body.salaryMin,
      );

      if (value === undefined) {
        return NextResponse.json(
          {
            error:
              "Minimum salary must be a valid positive number.",
          },
          {
            status: 400,
          },
        );
      }

      data.salaryMin = value;
    }

    if ("salaryMax" in body) {
      const value = parseMoney(
        body.salaryMax,
      );

      if (value === undefined) {
        return NextResponse.json(
          {
            error:
              "Maximum salary must be a valid positive number.",
          },
          {
            status: 400,
          },
        );
      }

      data.salaryMax = value;
    }

    const finalSalaryMin =
      "salaryMin" in data
        ? (data.salaryMin as number | null)
        : existing.salaryMin
          ? Number(existing.salaryMin)
          : null;

    const finalSalaryMax =
      "salaryMax" in data
        ? (data.salaryMax as number | null)
        : existing.salaryMax
          ? Number(existing.salaryMax)
          : null;

    if (
      finalSalaryMin !== null &&
      finalSalaryMax !== null &&
      finalSalaryMax < finalSalaryMin
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

    if ("vacancies" in body) {
      const vacancies = Number(
        body.vacancies,
      );

      if (
        !Number.isInteger(vacancies) ||
        vacancies < 1
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

      data.vacancies = vacancies;
    }

    if ("departmentId" in body) {
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

      data.departmentId = departmentId;
    }

    if ("hiringManagerId" in body) {
      const managerId = cleanString(
        body.hiringManagerId,
      );

      if (managerId) {
        const manager =
          await prisma.adminUser.findUnique({
            where: {
              id: managerId,
            },
            select: {
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

      data.hiringManagerId = managerId;
    }

    if ("openedAt" in body) {
      const value = parseDate(body.openedAt);

      if (
        body.openedAt &&
        value === undefined
      ) {
        return NextResponse.json(
          {
            error: "Invalid opening date.",
          },
          {
            status: 400,
          },
        );
      }

      data.openedAt = value;
    }

    if ("closesAt" in body) {
      const value = parseDate(body.closesAt);

      if (
        body.closesAt &&
        value === undefined
      ) {
        return NextResponse.json(
          {
            error: "Invalid closing date.",
          },
          {
            status: 400,
          },
        );
      }

      data.closesAt = value;
    }

    if ("targetStartDate" in body) {
      const value = parseDate(
        body.targetStartDate,
      );

      if (
        body.targetStartDate &&
        value === undefined
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid target start date.",
          },
          {
            status: 400,
          },
        );
      }

      data.targetStartDate = value;
    }

    if ("status" in body) {
      const status = enumValue(
        JobOpeningStatus,
        body.status,
      );

      if (!status) {
        return NextResponse.json(
          {
            error: "Invalid job status.",
          },
          {
            status: 400,
          },
        );
      }

      data.status = status;

      if (
        status === JobOpeningStatus.OPEN &&
        !existing.openedAt &&
        !("openedAt" in data)
      ) {
        data.openedAt = new Date();
      }
if (
  status === JobOpeningStatus.CLOSED ||
  status === JobOpeningStatus.FILLED ||
  status === JobOpeningStatus.CANCELLED
) {
  data.closedAt = new Date();
}

      if (
        status === JobOpeningStatus.OPEN ||
        status === JobOpeningStatus.PAUSED ||
        status === JobOpeningStatus.DRAFT
      ) {
        data.closedAt = null;
      }
    }

    if ("published" in body) {
      const published = Boolean(
        body.published,
      );

      data.published = published;

      data.publishedAt = published
        ? existing.publishedAt ??
          new Date()
        : null;
    }

    const finalOpenedAt =
      "openedAt" in data
        ? (data.openedAt as Date | null)
        : existing.openedAt;

    const finalClosesAt =
      "closesAt" in data
        ? (data.closesAt as Date | null)
        : existing.closesAt;

    if (
      finalOpenedAt &&
      finalClosesAt &&
      finalClosesAt < finalOpenedAt
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

    const job =
      await prisma.jobOpening.update({
        where: {
          id,
        },

        data,

        include: {
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

    return NextResponse.json({
      job: {
        ...job,

        salaryMin:
          job.salaryMin?.toString() ?? null,

        salaryMax:
          job.salaryMax?.toString() ?? null,
      },
    });
  } catch (error) {
    console.error(
      "[RECRUITMENT_JOB_PATCH]",
      error,
    );

    return NextResponse.json(
      {
        error: "Unable to update job opening.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    await requireTeamManager();

    const { id } = await context.params;

    const existing =
      await prisma.jobOpening.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          status: true,

          _count: {
            select: {
              applications: true,
            },
          },
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error: "Job opening not found.",
        },
        {
          status: 404,
        },
      );
    }

    // Preserve recruitment history.
    // Jobs with applications should never be
    // physically deleted.
    if (existing._count.applications > 0) {
      const job =
        await prisma.jobOpening.update({
          where: {
            id,
          },

          data: {
            status:
              JobOpeningStatus.CANCELLED,

            published: false,
            publishedAt: null,

            closedAt: new Date(),
          },
        });

      return NextResponse.json({
        success: true,
        deleted: false,
        archived: true,
        job,
      });
    }

    await prisma.jobOpening.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: true,
      archived: false,
    });
  } catch (error) {
    console.error(
      "[RECRUITMENT_JOB_DELETE]",
      error,
    );

    return NextResponse.json(
      {
        error: "Unable to remove job opening.",
      },
      {
        status: 500,
      },
    );
  }
}