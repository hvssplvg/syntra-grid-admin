import {
  NextRequest,
  NextResponse,
} from 'next/server';

import type { Prisma } from '@/app/generated/prisma/client';

import {
  AccessAction,
  AccessScope,
  EmployeeStatus,
  EmploymentType,
  WorkArrangement,
} from '@/app/generated/prisma/enums';

import {
  AuthenticationError,
  AuthorisationError,
  getCurrentIdentity,
  hasPermission,
  requireTeamManager,
} from '@/lib/auth/current-admin';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

  /*
   * Sensitive HR fields.
   * This endpoint is protected by admin authentication.
   * Do not add these fields to public/client-facing APIs.
   */
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
      description: true,
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

      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },

  directReports: {
    select: {
      id: true,
      employeeRef: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      jobTitle: true,
      avatarUrl: true,
      status: true,

      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },

    orderBy: [
      {
        firstName: 'asc',
      },
      {
        lastName: 'asc',
      },
    ],
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
      restrictedAccess: true,
      createdAt: true,
      updatedAt: true,

      permissionGrants: {
        select: {
          module: true,
          action: true,
          scope: true,
        },
      },
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

  const parsed =
    new Date(value);

  return Number.isNaN(
    parsed.getTime(),
  )
    ? null
    : parsed;
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

function hasOwn(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(
    value,
    key,
  );
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
  if (error instanceof AuthenticationError) {
    return 401;
  }

  if (error instanceof AuthorisationError) {
    return 403;
  }

  return 500;
}

/* ============================================================================
   MANAGER CYCLE PROTECTION
============================================================================ */

/**
 * Returns true if assigning candidateManagerId as employeeId's manager would
 * create a reporting cycle.
 *
 * Example blocked:
 *
 * Hassan -> Alice -> Bob
 *
 * Trying to make Bob the manager of Hassan would produce:
 *
 * Hassan -> Alice -> Bob -> Hassan
 */
async function wouldCreateManagerCycle(
  employeeId: string,
  candidateManagerId: string,
): Promise<boolean> {
  if (
    employeeId ===
    candidateManagerId
  ) {
    return true;
  }

  const visited =
    new Set<string>();

  let currentId:
    string | null =
    candidateManagerId;

  while (currentId) {
    if (
      currentId ===
      employeeId
    ) {
      return true;
    }

    if (
      visited.has(
        currentId,
      )
    ) {
      /*
       * Existing corrupted cycle.
       * Fail closed rather than allowing
       * another relationship into it.
       */
      return true;
    }

    visited.add(
      currentId,
    );

    const current:
      {
        managerId:
          string | null;
      } | null =
      await prisma.employee.findUnique({
        where: {
          id: currentId,
        },

        select: {
          managerId: true,
        },
      });

    if (!current) {
      return false;
    }

    currentId =
      current.managerId;
  }

  return false;
}

/* ============================================================================
   GET /api/admin/team/[id]
============================================================================ */

const CONFIDENTIAL_EMPLOYEE_FIELDS = [
  'personalEmail',
  'phone',
  'linkedinUrl',
  'bio',
  'notes',
  'emergencyContactName',
  'emergencyContactPhone',
  'emergencyContactRelationship',
] as const;

function stripConfidentialFields<T extends Record<string, unknown>>(
  employee: T,
): T {
  const safe: Record<string, unknown> = { ...employee };

  for (const field of CONFIDENTIAL_EMPLOYEE_FIELDS) {
    delete safe[field];
  }

  // A colleague's dashboard permission grants are an access-management
  // detail, not something another department member needs to see.
  if (safe.adminUser && typeof safe.adminUser === 'object') {
    const { permissionGrants, ...adminUserRest } =
      safe.adminUser as Record<string, unknown>;
    safe.adminUser = adminUserRest;
  }

  return safe as T;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await getCurrentIdentity();

    const canManageTeam =
      identity.isFullAccess;

    const canViewDepartmentTeam =
      hasPermission(
        identity,
        'team',
        AccessAction.VIEW,
        { scope: AccessScope.DEPARTMENT },
      );

    if (!canManageTeam && !canViewDepartmentTeam) {
      throw new AuthorisationError(
        'You are not authorised to view the team directory.',
      );
    }

    const {
      id,
    } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Employee ID is required.',
        },
        {
          status: 400,
        },
      );
    }

    const employee =
      await prisma.employee.findUnique({
        where: {
          id,
        },

        select:
          employeeSelect,
      });

    if (!employee) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Employee not found.',
        },
        {
          status: 404,
        },
      );
    }

    let visibleEmployee = employee;

    if (!canManageTeam) {
      const isOwnProfile =
        employee.id === identity.employee?.id;

      const isSameDepartment =
        identity.employee?.departmentId != null &&
        employee.departmentId === identity.employee.departmentId;

      if (!isOwnProfile && !isSameDepartment) {
        throw new AuthorisationError(
          'You are not authorised to view this employee.',
        );
      }

      if (!isOwnProfile) {
        // A colleague in the same department, not herself — strip
        // confidential fields regardless of what employeeSelect fetched.
        visibleEmployee = stripConfidentialFields(employee);
      }
    }

return NextResponse.json({
  ok: true,
  employee: visibleEmployee,

  summary: {
    directReports:
      employee._count.directReports,

    hasSystemAccess:
      Boolean(employee.adminUserId),

    hasDepartment:
      Boolean(employee.departmentId),

    hasManager:
      Boolean(employee.managerId),

    isCurrentEmployee:
      employee.status !== EmployeeStatus.FORMER &&
      employee.status !== EmployeeStatus.OFFBOARDING,
  },
});
  } catch (error) {
    console.error(
      'GET /api/admin/team/[id] failed:',
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error: getErrorMessage(
          error,
          'Could not load employee.',
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
   PATCH /api/admin/team/[id]
============================================================================ */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin =
      await requireTeamManager();

    const {
      id,
    } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Employee ID is required.',
        },
        {
          status: 400,
        },
      );
    }

    const existing =
      await prisma.employee.findUnique({
        where: {
          id,
        },

        select: {
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

          emergencyContactName:
            true,

          emergencyContactPhone:
            true,

          emergencyContactRelationship:
            true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Employee not found.',
        },
        {
          status: 404,
        },
      );
    }

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

    const data:
      Prisma.EmployeeUpdateInput =
      {};

    /* ------------------------------------------------------------------------
       NAME
    ------------------------------------------------------------------------ */

    if (
      hasOwn(
        input,
        'firstName',
      )
    ) {
      const firstName =
        requiredString(
          input.firstName,
        );

      if (!firstName) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'First name cannot be empty.',
          },
          {
            status: 400,
          },
        );
      }

      data.firstName =
        firstName;
    }

    if (
      hasOwn(
        input,
        'lastName',
      )
    ) {
      const lastName =
        requiredString(
          input.lastName,
        );

      if (!lastName) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Last name cannot be empty.',
          },
          {
            status: 400,
          },
        );
      }

      data.lastName =
        lastName;
    }

    if (
      hasOwn(
        input,
        'preferredName',
      )
    ) {
      data.preferredName =
        cleanOptionalString(
          input.preferredName,
        );
    }

    /* ------------------------------------------------------------------------
       EMPLOYEE REFERENCE
    ------------------------------------------------------------------------ */

    if (
      hasOwn(
        input,
        'employeeRef',
      )
    ) {
      const employeeRef =
        cleanOptionalString(
          input.employeeRef,
        )?.toUpperCase() ??
        null;

      if (employeeRef) {
        const duplicate =
          await prisma.employee.findFirst({
            where: {
              employeeRef,

              id: {
                not: id,
              },
            },

            select: {
              id: true,
            },
          });

        if (duplicate) {
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
      }

      data.employeeRef =
        employeeRef;
    }

    /* ------------------------------------------------------------------------
       CONTACT DETAILS
    ------------------------------------------------------------------------ */

    if (
      hasOwn(
        input,
        'personalEmail',
      )
    ) {
      const personalEmail =
        normaliseEmail(
          input.personalEmail,
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

      data.personalEmail =
        personalEmail;
    }

    if (
      hasOwn(
        input,
        'workEmail',
      )
    ) {
      const workEmail =
        normaliseEmail(
          input.workEmail,
        );

      if (
        workEmail &&
        !isValidEmail(
          workEmail,
        )
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
        const duplicate =
          await prisma.employee.findFirst({
            where: {
              workEmail,

              id: {
                not: id,
              },
            },

            select: {
              id: true,
            },
          });

        if (duplicate) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'Another employee already uses this work email.',
            },
            {
              status: 409,
            },
          );
        }
      }

      data.workEmail =
        workEmail;
    }

    if (
      hasOwn(
        input,
        'phone',
      )
    ) {
      data.phone =
        cleanOptionalString(
          input.phone,
        );
    }

    /* ------------------------------------------------------------------------
       PROFILE
    ------------------------------------------------------------------------ */

    if (
      hasOwn(
        input,
        'avatarUrl',
      )
    ) {
      data.avatarUrl =
        cleanOptionalString(
          input.avatarUrl,
        );
    }

    if (
      hasOwn(
        input,
        'country',
      )
    ) {
      data.country =
        cleanOptionalString(
          input.country,
        );
    }

    if (
      hasOwn(
        input,
        'city',
      )
    ) {
      data.city =
        cleanOptionalString(
          input.city,
        );
    }

    if (
      hasOwn(
        input,
        'jobTitle',
      )
    ) {
      const jobTitle =
        requiredString(
          input.jobTitle,
        );

      if (!jobTitle) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Job title cannot be empty.',
          },
          {
            status: 400,
          },
        );
      }

      data.jobTitle =
        jobTitle;
    }

    if (
      hasOwn(
        input,
        'linkedinUrl',
      )
    ) {
      data.linkedinUrl =
        cleanOptionalString(
          input.linkedinUrl,
        );
    }

    if (
      hasOwn(
        input,
        'bio',
      )
    ) {
      data.bio =
        cleanOptionalString(
          input.bio,
        );
    }

    if (
      hasOwn(
        input,
        'notes',
      )
    ) {
      data.notes =
        cleanOptionalString(
          input.notes,
        );
    }

    /* ------------------------------------------------------------------------
       STATUS
    ------------------------------------------------------------------------ */

    if (
      hasOwn(
        input,
        'status',
      )
    ) {
      const status =
        parseEmployeeStatus(
          input.status,
        );

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

      data.status =
        status;
    }

    if (
      hasOwn(
        input,
        'employmentType',
      )
    ) {
      const employmentType =
        parseEmploymentType(
          input.employmentType,
        );

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

      data.employmentType =
        employmentType;
    }

    if (
      hasOwn(
        input,
        'workArrangement',
      )
    ) {
      if (
        input.workArrangement ===
          null ||
        input.workArrangement ===
          ''
      ) {
        data.workArrangement =
          null;
      } else {
        const arrangement =
          parseWorkArrangement(
            input.workArrangement,
          );

        if (!arrangement) {
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

        data.workArrangement =
          arrangement;
      }
    }

    /* ------------------------------------------------------------------------
       DATES
    ------------------------------------------------------------------------ */

    let nextStartDate =
      existing.startDate;

    let nextEndDate =
      existing.endDate;

    if (
      hasOwn(
        input,
        'startDate',
      )
    ) {
      if (
        input.startDate ===
          null ||
        input.startDate === ''
      ) {
        nextStartDate =
          null;

        data.startDate =
          null;
      } else {
        const startDate =
          parseDate(
            input.startDate,
          );

        if (!startDate) {
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

        nextStartDate =
          startDate;

        data.startDate =
          startDate;
      }
    }

    if (
      hasOwn(
        input,
        'endDate',
      )
    ) {
      if (
        input.endDate ===
          null ||
        input.endDate === ''
      ) {
        nextEndDate =
          null;

        data.endDate =
          null;
      } else {
        const endDate =
          parseDate(
            input.endDate,
          );

        if (!endDate) {
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

        nextEndDate =
          endDate;

        data.endDate =
          endDate;
      }
    }

    if (
      nextStartDate &&
      nextEndDate &&
      nextEndDate <
        nextStartDate
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
       DEPARTMENT
    ------------------------------------------------------------------------ */

    if (
      hasOwn(
        input,
        'departmentId',
      )
    ) {
      const departmentId =
        cleanOptionalString(
          input.departmentId,
        );

      if (!departmentId) {
        data.department = {
          disconnect: true,
        };
      } else {
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
                'An archived department cannot receive employees.',
            },
            {
              status: 400,
            },
          );
        }

        data.department = {
          connect: {
            id: departmentId,
          },
        };
      }
    }

    /* ------------------------------------------------------------------------
       MANAGER
    ------------------------------------------------------------------------ */

    if (
      hasOwn(
        input,
        'managerId',
      )
    ) {
      const managerId =
        cleanOptionalString(
          input.managerId,
        );

      if (!managerId) {
        data.manager = {
          disconnect: true,
        };
      } else {
        if (
          managerId === id
        ) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'An employee cannot be their own manager.',
            },
            {
              status: 400,
            },
          );
        }

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
            EmployeeStatus.FORMER ||
          manager.status ===
            EmployeeStatus.OFFBOARDING
        ) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'A former or offboarding employee cannot be selected as a manager.',
            },
            {
              status: 400,
            },
          );
        }

        const createsCycle =
          await wouldCreateManagerCycle(
            id,
            managerId,
          );

        if (createsCycle) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'This manager assignment would create a reporting cycle.',
            },
            {
              status: 400,
            },
          );
        }

        data.manager = {
          connect: {
            id: managerId,
          },
        };
      }
    }

    /* ------------------------------------------------------------------------
       SYSTEM ACCESS
    ------------------------------------------------------------------------ */

    if (
      hasOwn(
        input,
        'adminUserId',
      )
    ) {
      const adminUserId =
        cleanOptionalString(
          input.adminUserId,
        );

      if (!adminUserId) {
        data.adminUser = {
          disconnect: true,
        };
      } else {
        const adminUser =
          await prisma.adminUser.findUnique({
            where: {
              id: adminUserId,
            },

            select: {
              id: true,
              active: true,
              employee: {
                select: {
                  id: true,
                },
              },
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

        if (
          adminUser.employee &&
          adminUser.employee.id !==
            id
        ) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'This system account is already connected to another employee.',
            },
            {
              status: 409,
            },
          );
        }

        data.adminUser = {
          connect: {
            id: adminUserId,
          },
        };
      }
    }

    /* ------------------------------------------------------------------------
       EMERGENCY CONTACT
    ------------------------------------------------------------------------ */

    if (
      hasOwn(
        input,
        'emergencyContactName',
      )
    ) {
      data.emergencyContactName =
        cleanOptionalString(
          input.emergencyContactName,
        );
    }

    if (
      hasOwn(
        input,
        'emergencyContactPhone',
      )
    ) {
      data.emergencyContactPhone =
        cleanOptionalString(
          input.emergencyContactPhone,
        );
    }

    if (
      hasOwn(
        input,
        'emergencyContactRelationship',
      )
    ) {
      data.emergencyContactRelationship =
        cleanOptionalString(
          input.emergencyContactRelationship,
        );
    }

    /* ------------------------------------------------------------------------
       NOTHING TO UPDATE
    ------------------------------------------------------------------------ */

    if (
      Object.keys(data).length ===
      0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No supported employee fields were provided.',
        },
        {
          status: 400,
        },
      );
    }

    /* ------------------------------------------------------------------------
       UPDATE
    ------------------------------------------------------------------------ */

    const employee =
      await prisma.$transaction(
        async (tx) => {
          const updated =
            await tx.employee.update({
              where: {
                id,
              },

              data,

              select:
                employeeSelect,
            });

          await tx.auditLog.create({
            data: {
              actorId:
                admin.id,

              action:
                'EMPLOYEE_UPDATED',

              entityType:
                'Employee',

              entityId:
                id,

              metadata: {
                employeeRef:
                  updated.employeeRef,

                firstName:
                  updated.firstName,

                lastName:
                  updated.lastName,

                jobTitle:
                  updated.jobTitle,

                status:
                  updated.status,

                departmentId:
                  updated.departmentId,

                managerId:
                  updated.managerId,

                adminUserId:
                  updated.adminUserId,

                updatedFields:
                  Object.keys(
                    input,
                  ),
              },
            },
          });

          return updated;
        },
      );

    return NextResponse.json({
      ok: true,
      employee,
    });
  } catch (error) {
    console.error(
      'PATCH /api/admin/team/[id] failed:',
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error: getErrorMessage(
          error,
          'Could not update employee.',
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
   DELETE /api/admin/team/[id]

   This is deliberately a soft offboarding action.
   We retain the employee record for company history and auditability.
============================================================================ */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin =
      await requireTeamManager();

    const {
      id,
    } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Employee ID is required.',
        },
        {
          status: 400,
        },
      );
    }

    const existing =
      await prisma.employee.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          employeeRef: true,
          firstName: true,
          lastName: true,
          status: true,
          adminUserId: true,

          _count: {
            select: {
              directReports: true,
            },
          },
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Employee not found.',
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Keep DELETE idempotent.
     */
    if (
      existing.status ===
      EmployeeStatus.FORMER
    ) {
      const employee =
        await prisma.employee.findUnique({
          where: {
            id,
          },

          select:
            employeeSelect,
        });

      return NextResponse.json({
        ok: true,
        employee,
        alreadyOffboarded:
          true,
      });
    }

    /*
     * We do not silently orphan direct reports.
     *
     * Reassign/remove their manager first through
     * the normal employee management UI.
     */
    if (
      existing._count
        .directReports > 0
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            'This employee still has direct reports. Reassign their reports before offboarding them.',

          directReports:
            existing._count
              .directReports,
        },
        {
          status: 409,
        },
      );
    }

    /*
     * Read the linked AdminUser's role before the transaction disconnects
     * it below, so we know whether it is safe to auto-disable.
     */
    const linkedAdminUser =
      existing.adminUserId
        ? await prisma.adminUser.findUnique({
            where: {
              id: existing.adminUserId,
            },

            select: {
              id: true,
              role: true,
              active: true,
            },
          })
        : null;

    let accessAutoDisabled = false;
    let ownerAccessRequiresManualAction = false;

    const employee =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Mark the HR record as former.
           *
           * The employee record itself is retained.
           */
          const updated =
            await tx.employee.update({
              where: {
                id,
              },

              data: {
                status:
                  EmployeeStatus.FORMER,

                endDate:
                  new Date(),

                /*
                 * Remove reporting relationship.
                 */
                manager: {
                  disconnect: true,
                },

                /*
                 * Detach dashboard identity from
                 * the employee HR record.
                 */
                adminUser: {
                  disconnect: true,
                },
              },

              select:
                employeeSelect,
            });

          /*
           * We detach the AdminUser relation above. Whether that account
           * is also disabled is the employee access/permissions workflow's
           * job (lib/access/server.ts and app/api/admin/team/[id]/access),
           * applied inline here so offboarding always disables access
           * automatically, except for an Owner account, which is never
           * silently disabled by this HR action.
           */
          if (
            linkedAdminUser &&
            linkedAdminUser.active
          ) {
            if (
              linkedAdminUser.role ===
              'OWNER'
            ) {
              ownerAccessRequiresManualAction =
                true;
            } else {
              await tx.adminUser.update({
                where: {
                  id: linkedAdminUser.id,
                },
                data: {
                  active: false,
                },
              });

              await tx.permissionGrant.deleteMany(
                {
                  where: {
                    adminUserId:
                      linkedAdminUser.id,
                  },
                },
              );

              accessAutoDisabled = true;
            }
          }

          await tx.auditLog.create({
            data: {
              actorId:
                admin.id,

              action:
                'EMPLOYEE_OFFBOARDED',

              entityType:
                'Employee',

              entityId:
                id,

              metadata: {
                employeeRef:
                  existing.employeeRef,

                firstName:
                  existing.firstName,

                lastName:
                  existing.lastName,

                previousStatus:
                  existing.status,

                previousAdminUserId:
                  existing.adminUserId,

                newStatus:
                  EmployeeStatus.FORMER,

                accessAutoDisabled,

                previousAdminUserRole:
                  linkedAdminUser?.role ??
                  null,
              },
            },
          });

          return updated;
        },
      );

    return NextResponse.json({
      ok: true,
      employee,
      offboarded: true,
      accessAutoDisabled,
      ownerAccessRequiresManualAction,
    });
  } catch (error) {
    console.error(
      'DELETE /api/admin/team/[id] failed:',
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error: getErrorMessage(
          error,
          'Could not offboard employee.',
        ),
      },
      {
        status:
          getErrorStatus(error),
      },
    );
  }
}