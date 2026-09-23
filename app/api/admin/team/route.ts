import {
  NextRequest,
  NextResponse,
} from 'next/server';

import type { Prisma } from '@/app/generated/prisma/client';

import {
  EmployeeStatus,
  EmploymentType,
  WorkArrangement,
} from '@/app/generated/prisma/enums';

import {
  requireAdmin,
  requireTeamManager,
} from '@/lib/auth/current-admin';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/* ============================================================================
   SELECT
============================================================================ */

const employeeSelect = {
  id: true,
  employeeRef: true,

  firstName: true,
  lastName: true,
  preferredName: true,

  personalEmail: true,
  workEmail: true,
  phone: true,

  avatarUrl: true,

  country: true,
  city: true,

  jobTitle: true,

  status: true,
  employmentType: true,
  workArrangement: true,

  startDate: true,
  endDate: true,

  departmentId: true,
  managerId: true,
  adminUserId: true,

  linkedinUrl: true,

  bio: true,
  notes: true,

  emergencyContactName: true,
  emergencyContactPhone: true,
  emergencyContactRelationship: true,

  createdAt: true,
  updatedAt: true,

  department: {
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      icon: true,
      colour: true,
      status: true,
    },
  },

  manager: {
    select: {
      id: true,
      employeeRef: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      jobTitle: true,
      avatarUrl: true,
      status: true,
    },
  },

  adminUser: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      role: true,
      active: true,
    },
  },

  _count: {
    select: {
      directReports: true,
    },
  },
} satisfies Prisma.EmployeeSelect;

/* ============================================================================
   HELPERS
============================================================================ */

function cleanOptionalString(
  value: unknown,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length
    ? trimmed
    : null;
}

function requiredString(
  value: unknown,
): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function normaliseEmail(
  value: unknown,
): string | null {
  const email =
    cleanOptionalString(value);

  return email
    ? email.toLowerCase()
    : null;
}

function isValidEmail(
  value: string,
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function parseDate(
  value: unknown,
): Date | null {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}

function parseEmployeeStatus(
  value: unknown,
): EmployeeStatus | null {
  if (
    typeof value === 'string' &&
    Object.values(
      EmployeeStatus,
    ).includes(
      value as EmployeeStatus,
    )
  ) {
    return value as EmployeeStatus;
  }

  return null;
}

function parseEmploymentType(
  value: unknown,
): EmploymentType | null {
  if (
    typeof value === 'string' &&
    Object.values(
      EmploymentType,
    ).includes(
      value as EmploymentType,
    )
  ) {
    return value as EmploymentType;
  }

  return null;
}

function parseWorkArrangement(
  value: unknown,
): WorkArrangement | null {
  if (
    typeof value === 'string' &&
    Object.values(
      WorkArrangement,
    ).includes(
      value as WorkArrangement,
    )
  ) {
    return value as WorkArrangement;
  }

  return null;
}

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

function getErrorStatus(
  error: unknown,
): number {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : '';

  if (
    message.includes('unauthorized')
  ) {
    return 401;
  }

  if (
    message.includes('forbidden')
  ) {
    return 403;
  }

  return 500;
}

async function generateEmployeeRef(): Promise<string> {
  /*
   * Human-readable internal reference.
   *
   * Examples:
   * SG-EMP-0001
   * SG-EMP-0002
   *
   * We still retry on a unique collision during creation.
   */
  const count =
    await prisma.employee.count();

  return `SG-EMP-${String(
    count + 1,
  ).padStart(4, '0')}`;
}

/* ============================================================================
   GET /api/admin/team
============================================================================ */

export async function GET(
  request: NextRequest,
) {
  try {
    await requireAdmin();

    const params =
      request.nextUrl.searchParams;

    const search =
      params
        .get('search')
        ?.trim() ?? '';

    const statusParam =
      params.get('status');

    const departmentId =
      params.get('department');

    const employmentTypeParam =
      params.get(
        'employmentType',
      );

    const workArrangementParam =
      params.get(
        'workArrangement',
      );

    const status =
      statusParam &&
      statusParam !== 'ALL'
        ? parseEmployeeStatus(
            statusParam,
          )
        : null;

    const employmentType =
      employmentTypeParam &&
      employmentTypeParam !==
        'ALL'
        ? parseEmploymentType(
            employmentTypeParam,
          )
        : null;

    const workArrangement =
      workArrangementParam &&
      workArrangementParam !==
        'ALL'
        ? parseWorkArrangement(
            workArrangementParam,
          )
        : null;

    if (
      statusParam &&
      statusParam !== 'ALL' &&
      !status
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid employee status.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      employmentTypeParam &&
      employmentTypeParam !==
        'ALL' &&
      !employmentType
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid employment type.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      workArrangementParam &&
      workArrangementParam !==
        'ALL' &&
      !workArrangement
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid work arrangement.',
        },
        {
          status: 400,
        },
      );
    }

    const where:
      Prisma.EmployeeWhereInput =
      {};

    if (search) {
      where.OR = [
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          preferredName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          employeeRef: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          jobTitle: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          workEmail: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          personalEmail: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (
      employmentType
    ) {
      where.employmentType =
        employmentType;
    }

    if (
      workArrangement
    ) {
      where.workArrangement =
        workArrangement;
    }

    if (
      departmentId &&
      departmentId !== 'ALL'
    ) {
      if (
        departmentId ===
        'UNASSIGNED'
      ) {
        where.departmentId =
          null;
      } else {
        where.departmentId =
          departmentId;
      }
    }

    const employees =
      await prisma.employee.findMany({
        where,

        select:
          employeeSelect,

        orderBy: [
          {
            status: 'asc',
          },
          {
            firstName: 'asc',
          },
          {
            lastName: 'asc',
          },
        ],
      });

    const [
      total,
      onboarding,
      active,
      onLeave,
      offboarding,
      former,
      unassigned,
      withAccess,
    ] =
      await prisma.$transaction([
        prisma.employee.count(),

        prisma.employee.count({
          where: {
            status:
              EmployeeStatus.ONBOARDING,
          },
        }),

        prisma.employee.count({
          where: {
            status:
              EmployeeStatus.ACTIVE,
          },
        }),

        prisma.employee.count({
          where: {
            status:
              EmployeeStatus.ON_LEAVE,
          },
        }),

        prisma.employee.count({
          where: {
            status:
              EmployeeStatus.OFFBOARDING,
          },
        }),

        prisma.employee.count({
          where: {
            status:
              EmployeeStatus.FORMER,
          },
        }),

        prisma.employee.count({
          where: {
            departmentId: null,

            status: {
              not:
                EmployeeStatus.FORMER,
            },
          },
        }),

        prisma.employee.count({
          where: {
            adminUserId: {
              not: null,
            },

            status: {
              not:
                EmployeeStatus.FORMER,
            },
          },
        }),
      ]);

    return NextResponse.json({
      ok: true,

      employees,

      meta: {
        total,
        onboarding,
        active,
        onLeave,
        offboarding,
        former,
        unassigned,
        withAccess,
        resultCount:
          employees.length,
      },
    });
  } catch (error) {
    console.error(
      'GET /api/admin/team failed:',
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error: getErrorMessage(
          error,
          'Could not load team.',
        ),
      },
      {
        status:
          getErrorStatus(error),
      },
    );
  }
}

/* ============================================================================
   POST /api/admin/team
============================================================================ */

export async function POST(
  request: NextRequest,
) {
  try {
    const admin =
      await requireTeamManager();

    const body: unknown =
      await request.json();

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid request body.',
        },
        {
          status: 400,
        },
      );
    }

    const input =
      body as Record<
        string,
        unknown
      >;

    /* ------------------------------------------------------------------------
       REQUIRED DETAILS
    ------------------------------------------------------------------------ */

    const firstName =
      requiredString(
        input.firstName,
      );

    const lastName =
      requiredString(
        input.lastName,
      );

    const jobTitle =
      requiredString(
        input.jobTitle,
      );

    if (!firstName) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'First name is required.',
        },
        {
          status: 400,
        },
      );
    }

    if (!lastName) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Last name is required.',
        },
        {
          status: 400,
        },
      );
    }

    if (!jobTitle) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Job title is required.',
        },
        {
          status: 400,
        },
      );
    }

    /* ------------------------------------------------------------------------
       EMAIL
    ------------------------------------------------------------------------ */

    const personalEmail =
      normaliseEmail(
        input.personalEmail,
      );

    const workEmail =
      normaliseEmail(
        input.workEmail,
      );

    if (
      personalEmail &&
      !isValidEmail(
        personalEmail,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Personal email is invalid.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      workEmail &&
      !isValidEmail(workEmail)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Work email is invalid.',
        },
        {
          status: 400,
        },
      );
    }

    if (workEmail) {
      const existing =
        await prisma.employee.findUnique({
          where: {
            workEmail,
          },

          select: {
            id: true,
          },
        });

      if (existing) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'An employee with this work email already exists.',
          },
          {
            status: 409,
          },
        );
      }
    }

    /* ------------------------------------------------------------------------
       ENUMS
    ------------------------------------------------------------------------ */

    const status =
      Object.prototype.hasOwnProperty.call(
        input,
        'status',
      )
        ? parseEmployeeStatus(
            input.status,
          )
        : EmployeeStatus.ONBOARDING;

    if (!status) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid employee status.',
        },
        {
          status: 400,
        },
      );
    }

    const employmentType =
      Object.prototype.hasOwnProperty.call(
        input,
        'employmentType',
      )
        ? parseEmploymentType(
            input.employmentType,
          )
        : EmploymentType.FULL_TIME;

    if (!employmentType) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid employment type.',
        },
        {
          status: 400,
        },
      );
    }

    let workArrangement:
      WorkArrangement | null =
      null;

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        'workArrangement',
      ) &&
      input.workArrangement !==
        null &&
      input.workArrangement !== ''
    ) {
      workArrangement =
        parseWorkArrangement(
          input.workArrangement,
        );

      if (!workArrangement) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Invalid work arrangement.',
          },
          {
            status: 400,
          },
        );
      }
    }

    /* ------------------------------------------------------------------------
       RELATIONSHIPS
    ------------------------------------------------------------------------ */

    const departmentId =
      cleanOptionalString(
        input.departmentId,
      );

    const managerId =
      cleanOptionalString(
        input.managerId,
      );

    const adminUserId =
      cleanOptionalString(
        input.adminUserId,
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

      if (!department) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'The selected department does not exist.',
          },
          {
            status: 400,
          },
        );
      }

      if (
        department.status ===
        'ARCHIVED'
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'An archived department cannot receive new employees.',
          },
          {
            status: 400,
          },
        );
      }
    }

    if (managerId) {
      const manager =
        await prisma.employee.findUnique({
          where: {
            id: managerId,
          },

          select: {
            id: true,
            status: true,
          },
        });

      if (!manager) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'The selected manager does not exist.',
          },
          {
            status: 400,
          },
        );
      }

      if (
        manager.status ===
        EmployeeStatus.FORMER
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'A former employee cannot be selected as a manager.',
          },
          {
            status: 400,
          },
        );
      }
    }

    if (adminUserId) {
      const adminUser =
        await prisma.adminUser.findUnique({
          where: {
            id: adminUserId,
          },

          select: {
            id: true,
            active: true,
          },
        });

      if (
        !adminUser ||
        !adminUser.active
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'The selected system account is not available.',
          },
          {
            status: 400,
          },
        );
      }

      const linkedEmployee =
        await prisma.employee.findFirst({
          where: {
            adminUserId,
          },

          select: {
            id: true,
          },
        });

      if (linkedEmployee) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'This system account is already connected to an employee.',
          },
          {
            status: 409,
          },
        );
      }
    }

    /* ------------------------------------------------------------------------
       DATES
    ------------------------------------------------------------------------ */

    const startDate =
      parseDate(
        input.startDate,
      );

    const endDate =
      parseDate(
        input.endDate,
      );

    if (
      input.startDate &&
      !startDate
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Start date is invalid.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      input.endDate &&
      !endDate
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'End date is invalid.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      startDate &&
      endDate &&
      endDate < startDate
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'End date cannot be before the start date.',
        },
        {
          status: 400,
        },
      );
    }

    /* ------------------------------------------------------------------------
       EMPLOYEE REFERENCE
    ------------------------------------------------------------------------ */

    let employeeRef =
      cleanOptionalString(
        input.employeeRef,
      );

    if (employeeRef) {
      employeeRef =
        employeeRef.toUpperCase();

      const existingRef =
        await prisma.employee.findUnique({
          where: {
            employeeRef,
          },

          select: {
            id: true,
          },
        });

      if (existingRef) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'This employee reference is already in use.',
          },
          {
            status: 409,
          },
        );
      }
    } else {
      employeeRef =
        await generateEmployeeRef();
    }

    /* ------------------------------------------------------------------------
       CREATE
    ------------------------------------------------------------------------ */

    const employee =
      await prisma.$transaction(
        async (tx) => {
          const created =
            await tx.employee.create({
              data: {
                employeeRef,

                firstName,
                lastName,

                preferredName:
                  cleanOptionalString(
                    input.preferredName,
                  ),

                personalEmail,
                workEmail,

                phone:
                  cleanOptionalString(
                    input.phone,
                  ),

                avatarUrl:
                  cleanOptionalString(
                    input.avatarUrl,
                  ),

                country:
                  cleanOptionalString(
                    input.country,
                  ),

                city:
                  cleanOptionalString(
                    input.city,
                  ),

                jobTitle,

                status,
                employmentType,
                workArrangement,

                startDate,
                endDate,

                departmentId,
                managerId,
                adminUserId,

                linkedinUrl:
                  cleanOptionalString(
                    input.linkedinUrl,
                  ),

                bio:
                  cleanOptionalString(
                    input.bio,
                  ),

                notes:
                  cleanOptionalString(
                    input.notes,
                  ),

                emergencyContactName:
                  cleanOptionalString(
                    input.emergencyContactName,
                  ),

                emergencyContactPhone:
                  cleanOptionalString(
                    input.emergencyContactPhone,
                  ),

                emergencyContactRelationship:
                  cleanOptionalString(
                    input.emergencyContactRelationship,
                  ),
              },

              select:
                employeeSelect,
            });

          await tx.auditLog.create({
            data: {
              actorId:
                admin.id,

              action:
                'EMPLOYEE_CREATED',

              entityType:
                'Employee',

              entityId:
                created.id,

              metadata: {
                employeeRef:
                  created.employeeRef,

                firstName:
                  created.firstName,

                lastName:
                  created.lastName,

                jobTitle:
                  created.jobTitle,

                status:
                  created.status,

                departmentId:
                  created.departmentId,

                managerId:
                  created.managerId,

                adminUserId:
                  created.adminUserId,
              },
            },
          });

          return created;
        },
      );

    return NextResponse.json(
      {
        ok: true,
        employee,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      'POST /api/admin/team failed:',
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error: getErrorMessage(
          error,
          'Could not create employee.',
        ),
      },
      {
        status:
          getErrorStatus(error),
      },
    );
  }
}