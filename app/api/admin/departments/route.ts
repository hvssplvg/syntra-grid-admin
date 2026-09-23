import {
  NextRequest,
  NextResponse,
} from 'next/server';

import type { Prisma } from '@/app/generated/prisma/client';
import { DepartmentStatus } from '@/app/generated/prisma/enums';

import {
  requireAdmin,
  requireTeamManager,
} from '@/lib/auth/current-admin';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/* ============================================================================
   SELECT
============================================================================ */

const departmentSelect = {
  id: true,
  name: true,
  slug: true,
  code: true,
  description: true,
  status: true,
  icon: true,
  colour: true,
  leadId: true,
  parentId: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,

  lead: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
      role: true,
      active: true,
    },
  },

  parent: {
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      status: true,
    },
  },

  children: {
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      status: true,
      displayOrder: true,

      _count: {
        select: {
          members: true,
        },
      },
    },

    orderBy: [
      {
        displayOrder: 'asc',
      },
      {
        name: 'asc',
      },
    ],
  },

  members: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
      role: true,
      active: true,
    },

    orderBy: [
      {
        firstName: 'asc',
      },
      {
        lastName: 'asc',
      },
      {
        email: 'asc',
      },
    ],

    take: 8,
  },

  _count: {
    select: {
      members: true,
      children: true,
    },
  },
} satisfies Prisma.DepartmentSelect;

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

  return trimmed.length > 0
    ? trimmed
    : null;
}

function makeSlug(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseStatus(
  value: unknown,
): DepartmentStatus | null {
  if (
    typeof value === 'string' &&
    Object.values(DepartmentStatus).includes(
      value as DepartmentStatus,
    )
  ) {
    return value as DepartmentStatus;
  }

  return null;
}

function parseDisplayOrder(
  value: unknown,
): number {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0
  ) {
    return value;
  }

  if (
    typeof value === 'string' &&
    value.trim() !== ''
  ) {
    const parsed = Number(value);

    if (
      Number.isInteger(parsed) &&
      parsed >= 0
    ) {
      return parsed;
    }
  }

  return 0;
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

/* ============================================================================
   GET /api/admin/departments
============================================================================ */

export async function GET(
  request: NextRequest,
) {
  try {
    await requireAdmin();

    const searchParams =
      request.nextUrl.searchParams;

    const search =
      searchParams
        .get('search')
        ?.trim() ?? '';

    const statusParam =
      searchParams.get('status');

    const parentParam =
      searchParams.get('parent');

    const status =
      statusParam &&
      statusParam !== 'ALL'
        ? parseStatus(statusParam)
        : null;

    /*
     * If a status was explicitly supplied but
     * wasn't valid, return a useful 400 rather
     * than silently ignoring it.
     */
    if (
      statusParam &&
      statusParam !== 'ALL' &&
      !status
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid department status.',
        },
        {
          status: 400,
        },
      );
    }

    const where:
      Prisma.DepartmentWhereInput =
      {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          slug: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          code: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          description: {
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
      parentParam === 'ROOT'
    ) {
      where.parentId = null;
    } else if (
      parentParam &&
      parentParam !== 'ALL'
    ) {
      where.parentId =
        parentParam;
    }

    const departments =
      await prisma.department.findMany({
        where,

        select:
          departmentSelect,

        orderBy: [
          {
            displayOrder: 'asc',
          },
          {
            name: 'asc',
          },
        ],
      });

    const [
      total,
      active,
      paused,
      archived,
      rootDepartments,
      assignedMembers,
    ] = await prisma.$transaction([
      prisma.department.count(),

      prisma.department.count({
        where: {
          status:
            DepartmentStatus.ACTIVE,
        },
      }),

      prisma.department.count({
        where: {
          status:
            DepartmentStatus.PAUSED,
        },
      }),

      prisma.department.count({
        where: {
          status:
            DepartmentStatus.ARCHIVED,
        },
      }),

      prisma.department.count({
        where: {
          parentId: null,

          status: {
            not:
              DepartmentStatus.ARCHIVED,
          },
        },
      }),

      prisma.adminUser.count({
        where: {
          active: true,

          departmentId: {
            not: null,
          },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,

      departments,

      meta: {
        total,
        active,
        paused,
        archived,
        rootDepartments,
        assignedMembers,
        resultCount:
          departments.length,
      },
    });
  } catch (error) {
    console.error(
      'GET /api/admin/departments failed:',
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error: getErrorMessage(
          error,
          'Could not load departments.',
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
   POST /api/admin/departments
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
       NAME
    ------------------------------------------------------------------------ */

    const name =
      typeof input.name === 'string'
        ? input.name.trim()
        : '';

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Department name is required.',
        },
        {
          status: 400,
        },
      );
    }

    if (name.length > 120) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Department name must be 120 characters or fewer.',
        },
        {
          status: 400,
        },
      );
    }

    /* ------------------------------------------------------------------------
       SLUG
    ------------------------------------------------------------------------ */

    const requestedSlug =
      typeof input.slug === 'string'
        ? input.slug.trim()
        : '';

    const slug = makeSlug(
      requestedSlug || name,
    );

    if (!slug) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'A valid department slug could not be generated.',
        },
        {
          status: 400,
        },
      );
    }

    /* ------------------------------------------------------------------------
       CODE
    ------------------------------------------------------------------------ */

    const rawCode =
      cleanOptionalString(
        input.code,
      );

    const code =
      rawCode?.toUpperCase() ??
      null;

    if (
      code &&
      code.length > 12
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Department code must be 12 characters or fewer.',
        },
        {
          status: 400,
        },
      );
    }

    /* ------------------------------------------------------------------------
       OPTIONAL FIELDS
    ------------------------------------------------------------------------ */

    const description =
      cleanOptionalString(
        input.description,
      );

    const icon =
      cleanOptionalString(
        input.icon,
      );

    const colour =
      cleanOptionalString(
        input.colour,
      );

    const leadId =
      cleanOptionalString(
        input.leadId,
      );

    const parentId =
      cleanOptionalString(
        input.parentId,
      );

   /* ------------------------------------------------------------------------
   STATUS
------------------------------------------------------------------------ */

let status: DepartmentStatus =
  DepartmentStatus.ACTIVE;

if (
  Object.prototype.hasOwnProperty.call(
    input,
    'status',
  )
) {
  const parsed =
    parseStatus(
      input.status,
    );

  if (!parsed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Invalid department status.',
      },
      {
        status: 400,
      },
    );
  }

  status = parsed;
}

    /* ------------------------------------------------------------------------
       DISPLAY ORDER
    ------------------------------------------------------------------------ */

    const displayOrder =
      parseDisplayOrder(
        input.displayOrder,
      );

    /* ------------------------------------------------------------------------
       DUPLICATE CHECK
    ------------------------------------------------------------------------ */

    const duplicateConditions:
      Prisma.DepartmentWhereInput[] =
      [
        {
          slug,
        },
      ];

    if (code) {
      duplicateConditions.push({
        code,
      });
    }

    const duplicate =
      await prisma.department.findFirst({
        where: {
          OR:
            duplicateConditions,
        },

        select: {
          id: true,
          slug: true,
          code: true,
        },
      });

    if (duplicate) {
      if (
        duplicate.slug === slug
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'A department with this slug already exists.',
          },
          {
            status: 409,
          },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            'A department with this code already exists.',
        },
        {
          status: 409,
        },
      );
    }

    /* ------------------------------------------------------------------------
       LEAD VALIDATION
    ------------------------------------------------------------------------ */

    if (leadId) {
      const lead =
        await prisma.adminUser.findUnique({
          where: {
            id: leadId,
          },

          select: {
            id: true,
            active: true,
          },
        });

      if (
        !lead ||
        !lead.active
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'The selected department lead is not available.',
          },
          {
            status: 400,
          },
        );
      }
    }

    /* ------------------------------------------------------------------------
       PARENT VALIDATION
    ------------------------------------------------------------------------ */

    if (parentId) {
      const parent =
        await prisma.department.findUnique({
          where: {
            id: parentId,
          },

          select: {
            id: true,
            status: true,
          },
        });

      if (!parent) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'The selected parent department does not exist.',
          },
          {
            status: 400,
          },
        );
      }

      if (
        parent.status ===
        DepartmentStatus.ARCHIVED
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'An archived department cannot be used as a parent.',
          },
          {
            status: 400,
          },
        );
      }
    }

    /* ------------------------------------------------------------------------
       CREATE + AUDIT
    ------------------------------------------------------------------------ */

    const department =
      await prisma.$transaction(
        async (tx) => {
          const created =
            await tx.department.create({
              data: {
                name,
                slug,
                code,
                description,
                status,
                icon,
                colour,
                leadId,
                parentId,
                displayOrder,
              },

              select:
                departmentSelect,
            });

          await tx.auditLog.create({
            data: {
              actorId:
                admin.id,

              action:
                'DEPARTMENT_CREATED',

              entityType:
                'Department',

              entityId:
                created.id,

              metadata: {
                name:
                  created.name,

                slug:
                  created.slug,

                code:
                  created.code,

                status:
                  created.status,

                leadId:
                  created.leadId,

                parentId:
                  created.parentId,

                displayOrder:
                  created.displayOrder,
              },
            },
          });

          return created;
        },
      );

    return NextResponse.json(
      {
        ok: true,
        department,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      'POST /api/admin/departments failed:',
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error: getErrorMessage(
          error,
          'Could not create department.',
        ),
      },
      {
        status:
          getErrorStatus(error),
      },
    );
  }
}