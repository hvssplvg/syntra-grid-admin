import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { prisma } from '@/lib/prisma';

import {
  requireAdmin,
  requireTeamManager,
} from '@/lib/auth/current-admin';

import type { Prisma } from '@/app/generated/prisma/client';
import { DepartmentStatus } from '@/app/generated/prisma/enums';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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
      description: true,
      status: true,
      icon: true,
      colour: true,
      leadId: true,
      displayOrder: true,

      lead: {
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
          members: true,
          children: true,
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
      createdAt: true,
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
  },

  _count: {
    select: {
      members: true,
      children: true,
    },
  },
} satisfies Prisma.DepartmentSelect;

function cleanOptionalString(
  value: unknown,
) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function makeSlug(value: string) {
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
    Object.values(
      DepartmentStatus,
    ).includes(
      value as DepartmentStatus,
    )
  ) {
    return value as DepartmentStatus;
  }

  return null;
}

function parseDisplayOrder(
  value: unknown,
): number | null {
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

  return null;
}

async function createsCycle(
  departmentId: string,
  proposedParentId: string,
): Promise<boolean> {
  let currentId: string | null = proposedParentId;

  const visited = new Set<string>();

  while (currentId !== null) {
    if (currentId === departmentId) {
      return true;
    }

    if (visited.has(currentId)) {
      return true;
    }

    visited.add(currentId);

    const department: {
      parentId: string | null;
    } | null = await prisma.department.findUnique({
      where: {
        id: currentId,
      },
      select: {
        parentId: true,
      },
    });

    if (!department) {
      return false;
    }

    currentId = department.parentId;
  }

  return false;
}
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    await requireAdmin();

    const { id } =
      await context.params;

    const department =
      await prisma.department.findUnique({
        where: {
          id,
        },
        select: departmentSelect,
      });

    if (!department) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Department not found.',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      department,
    });
  } catch (error) {
    console.error(
      'GET /api/admin/departments/[id] failed:',
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : 'Could not load department.';

    const status =
      message.toLowerCase().includes('unauthorized')
        ? 401
        : message.toLowerCase().includes('forbidden')
          ? 403
          : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin =
      await requireTeamManager();

    const { id } =
      await context.params;

    const existing =
      await prisma.department.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          code: true,
          status: true,
          leadId: true,
          parentId: true,
          displayOrder: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Department not found.',
        },
        { status: 404 },
      );
    }

    const body =
      await request.json();

    const data:
      Prisma.DepartmentUpdateInput =
      {};

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'name',
      )
    ) {
      const name =
        typeof body.name === 'string'
          ? body.name.trim()
          : '';

      if (!name) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Department name cannot be empty.',
          },
          { status: 400 },
        );
      }

      if (name.length > 120) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Department name must be 120 characters or fewer.',
          },
          { status: 400 },
        );
      }

      data.name = name;
    }

    let nextSlug =
      existing.slug;

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'slug',
      )
    ) {
      const requested =
        typeof body.slug === 'string'
          ? body.slug.trim()
          : '';

      nextSlug = makeSlug(
        requested ||
          (typeof data.name ===
          'string'
            ? data.name
            : existing.name),
      );

      if (!nextSlug) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'A valid department slug is required.',
          },
          { status: 400 },
        );
      }

      data.slug = nextSlug;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'code',
      )
    ) {
      const value =
        cleanOptionalString(
          body.code,
        );

      const code =
        value?.toUpperCase() ??
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
          { status: 400 },
        );
      }

      data.code = code;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'description',
      )
    ) {
      data.description =
        cleanOptionalString(
          body.description,
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'icon',
      )
    ) {
      data.icon =
        cleanOptionalString(
          body.icon,
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'colour',
      )
    ) {
      data.colour =
        cleanOptionalString(
          body.colour,
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'status',
      )
    ) {
      const status =
        parseStatus(body.status);

      if (!status) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Invalid department status.',
          },
          { status: 400 },
        );
      }

      data.status = status;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'displayOrder',
      )
    ) {
      const displayOrder =
        parseDisplayOrder(
          body.displayOrder,
        );

      if (
        displayOrder === null
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Display order must be a non-negative integer.',
          },
          { status: 400 },
        );
      }

      data.displayOrder =
        displayOrder;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'leadId',
      )
    ) {
      const leadId =
        cleanOptionalString(
          body.leadId,
        );

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
            { status: 400 },
          );
        }

        data.lead = {
          connect: {
            id: leadId,
          },
        };
      } else {
        data.lead = {
          disconnect: true,
        };
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'parentId',
      )
    ) {
      const parentId =
        cleanOptionalString(
          body.parentId,
        );

      if (parentId) {
        if (parentId === id) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'A department cannot be its own parent.',
            },
            { status: 400 },
          );
        }

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
            { status: 400 },
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
            { status: 400 },
          );
        }

        if (
          await createsCycle(
            id,
            parentId,
          )
        ) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'This parent selection would create a department hierarchy cycle.',
            },
            { status: 400 },
          );
        }

        data.parent = {
          connect: {
            id: parentId,
          },
        };
      } else {
        data.parent = {
          disconnect: true,
        };
      }
    }

    const nextCode =
      Object.prototype.hasOwnProperty.call(
        body,
        'code',
      )
        ? cleanOptionalString(
            body.code,
          )?.toUpperCase() ??
          null
        : existing.code;

    if (
      nextSlug !== existing.slug ||
      nextCode !== existing.code
    ) {
      const duplicate =
        await prisma.department.findFirst({
          where: {
            id: {
              not: id,
            },
            OR: [
              {
                slug: nextSlug,
              },
              ...(nextCode
                ? [
                    {
                      code:
                        nextCode,
                    },
                  ]
                : []),
            ],
          },
          select: {
            id: true,
            slug: true,
            code: true,
          },
        });

      if (duplicate) {
        if (
          duplicate.slug ===
          nextSlug
        ) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'A department with this slug already exists.',
            },
            { status: 409 },
          );
        }

        return NextResponse.json(
          {
            ok: false,
            error:
              'A department with this code already exists.',
          },
          { status: 409 },
        );
      }
    }

    const department =
      await prisma.$transaction(
        async (tx) => {
          const updated =
            await tx.department.update({
              where: {
                id,
              },
              data,
              select:
                departmentSelect,
            });

          await tx.auditLog.create({
            data: {
              actorId: admin.id,
              action:
                'DEPARTMENT_UPDATED',
              entityType:
                'Department',
              entityId: id,
              metadata: {
                previous: {
                  name:
                    existing.name,
                  slug:
                    existing.slug,
                  code:
                    existing.code,
                  status:
                    existing.status,
                  leadId:
                    existing.leadId,
                  parentId:
                    existing.parentId,
                  displayOrder:
                    existing.displayOrder,
                },
                current: {
                  name:
                    updated.name,
                  slug:
                    updated.slug,
                  code:
                    updated.code,
                  status:
                    updated.status,
                  leadId:
                    updated.leadId,
                  parentId:
                    updated.parentId,
                  displayOrder:
                    updated.displayOrder,
                },
              },
            },
          });

          return updated;
        },
      );

    return NextResponse.json({
      ok: true,
      department,
    });
  } catch (error) {
    console.error(
      'PATCH /api/admin/departments/[id] failed:',
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : 'Could not update department.';

    const status =
      message.toLowerCase().includes('unauthorized')
        ? 401
        : message.toLowerCase().includes('forbidden')
          ? 403
          : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin =
      await requireTeamManager();

    const { id } =
      await context.params;

    const existing =
      await prisma.department.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,

          _count: {
            select: {
              members: true,
              children: true,
            },
          },
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Department not found.',
        },
        { status: 404 },
      );
    }

    if (
      existing.status ===
      DepartmentStatus.ARCHIVED
    ) {
      return NextResponse.json({
        ok: true,
        department: {
          id: existing.id,
          status:
            DepartmentStatus.ARCHIVED,
        },
      });
    }

    const department =
      await prisma.$transaction(
        async (tx) => {
          const archived =
            await tx.department.update({
              where: {
                id,
              },
              data: {
                status:
                  DepartmentStatus.ARCHIVED,
              },
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                updatedAt: true,
              },
            });

          await tx.auditLog.create({
            data: {
              actorId: admin.id,
              action:
                'DEPARTMENT_ARCHIVED',
              entityType:
                'Department',
              entityId: id,
              metadata: {
                name:
                  existing.name,
                slug:
                  existing.slug,
                memberCount:
                  existing._count
                    .members,
                childCount:
                  existing._count
                    .children,
              },
            },
          });

          return archived;
        },
      );

    return NextResponse.json({
      ok: true,
      department,
    });
  } catch (error) {
    console.error(
      'DELETE /api/admin/departments/[id] failed:',
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : 'Could not archive department.';

    const status =
      message.toLowerCase().includes('unauthorized')
        ? 401
        : message.toLowerCase().includes('forbidden')
          ? 403
          : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}