import {
  CalendarEventPriority,
  CalendarEventScope,
  CalendarEventType,
} from "@/app/generated/prisma/client";

import {
  calendarApiError,
  employeeName,
  requireCalendarIdentity,
} from "@/lib/calendar/server";

import { prisma } from "@/lib/prisma";

/*
 * Who can do what in the calendar.
 *
 * Calendar managers (decided in requireCalendarIdentity, Owner and Admin):
 *   create for anyone, any scope, see every calendar and department.
 *
 * Everyone else with dashboard access, except Viewers:
 *   create personal events on their own calendar only.
 *
 * Viewers:
 *   read only.
 *
 * The POST route must enforce the same rules. Hiding buttons is not enough.
 */
const READ_ONLY_ROLES = new Set(["VIEWER"]);

export async function GET() {
  try {
    const identity = await requireCalendarIdentity();

    const isManager = identity.isCalendarManager;
    const canCreate = isManager || !READ_ONLY_ROLES.has(identity.admin.role);

    const [employees, departments, clients, projects] = await Promise.all([
      prisma.employee.findMany({
        where: {
          status: {
            in: ["ACTIVE", "ONBOARDING", "ON_LEAVE"],
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          avatarUrl: true,
          jobTitle: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),

      prisma.department.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          slug: true,
          colour: true,
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      }),

      prisma.client.findMany({
        where: {
          status: {
            in: ["ONBOARDING", "ACTIVE", "PAUSED"],
          },
        },
        select: {
          id: true,
          name: true,
          displayName: true,
          status: true,
        },
        orderBy: { name: "asc" },
      }),

      prisma.project.findMany({
        where: {
          status: { not: "ARCHIVED" },
        },
        select: {
          id: true,
          name: true,
          clientId: true,
          status: true,
          client: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    /*
     * Employees only need their own department.
     * Calendar managers receive every department.
     */
    const visibleDepartments = isManager
      ? departments
      : departments.filter(
          (department) => department.id === identity.employee.departmentId,
        );

    const scopes = isManager
      ? Object.values(CalendarEventScope)
      : [CalendarEventScope.PERSONAL];

    return Response.json({
      viewer: {
        employeeId: identity.employee.id,
        name: employeeName(identity.employee),
        avatarUrl: identity.employee.avatarUrl,
        departmentId: identity.employee.departmentId,
        departmentName:
          departments.find(
            (department) => department.id === identity.employee.departmentId,
          )?.name ?? null,
        role: identity.admin.role,
        isCalendarManager: isManager,
      },

      permissions: {
        /* Names the Calendar tab reads */
        isManager,
        canCreate,
        canCreateForOthers: isManager,
        canViewCompany: isManager,
        canFilterEmployees: isManager,
        canFilterDepartments: isManager,

        /* Original names, kept so nothing else breaks */
        canViewCompanyCalendar: isManager,
        canViewAllDepartments: isManager,
        canViewEmployeeCalendars: isManager,
        canCreateCompanyEvents: isManager,
        canCreateDepartmentEvents: isManager,
        canCreateWorkspaceEvents: isManager,
      },

      eventTypes: Object.values(CalendarEventType),

      /* Both names, the tab reads `scopes` */
      scopes,
      eventScopes: scopes,

      priorities: Object.values(CalendarEventPriority),

      employees: employees.map((employee) => ({
        id: employee.id,
        name: employeeName(employee),
        avatarUrl: employee.avatarUrl,
        jobTitle: employee.jobTitle,
        departmentId: employee.departmentId,
        departmentName: employee.department?.name ?? null,
        department: employee.department,
      })),

      departments: visibleDepartments,

      clients: clients.map((client) => ({
        id: client.id,
        name: client.displayName || client.name,
        status: client.status,
      })),

      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        clientId: project.clientId,
        clientName: project.client
          ? project.client.displayName || project.client.name
          : null,
      })),
    });
  } catch (error) {
    return calendarApiError(error);
  }
}