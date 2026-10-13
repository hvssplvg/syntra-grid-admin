import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, getCurrentAdmin } from "@/lib/auth/current-admin";
import {
  calculateLengthOfService,
  formatEmployeeStatus,
  formatEmploymentType,
  formatWorkLocation,
} from "@/lib/employment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function buildProfilePayload(admin: Awaited<ReturnType<typeof getCurrentAdmin>>) {
  const employee = await prisma.employee.findUnique({
    where: { adminUserId: admin.id },
    select: {
      id: true,
      employeeRef: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      jobTitle: true,
      avatarUrl: true,
      workEmail: true,
      phone: true,
      city: true,
      country: true,
      employmentType: true,
      workArrangement: true,
      startDate: true,
      status: true,
      department: { select: { id: true, name: true } },
      manager: { select: { firstName: true, lastName: true } },
    },
  });

  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    restrictedAccess: admin.restrictedAccess,

    firstName: employee?.firstName ?? admin.firstName,
    lastName: employee?.lastName ?? admin.lastName,

    preferredName: employee?.preferredName ?? null,

    fullName: employee
      ? `${employee.firstName} ${employee.lastName}`.trim()
      : `${admin.firstName ?? ""} ${admin.lastName ?? ""}`.trim(),

    avatarUrl:
      employee?.avatarUrl?.trim() ||
      admin.avatarUrl?.trim() ||
      null,

    jobTitle: employee?.jobTitle ?? null,
    department: employee?.department ?? null,
    employeeId: employee?.id ?? null,

    hasEmployeeRecord: Boolean(employee),

    phone: employee?.phone ?? null,
    city: employee?.city ?? null,
    country: employee?.country ?? null,

    // Employment facts — read-only, sourced only from the real
    // employment record. Never AdminUser.createdAt/Employee.createdAt.
    employeeRef: employee?.employeeRef ?? null,
    employmentType: formatEmploymentType(employee?.employmentType ?? null),
    startDate: employee?.startDate?.toISOString() ?? null,
    lengthOfService: employee?.startDate ? calculateLengthOfService(employee.startDate) : null,
    reportsTo: employee?.manager ? `${employee.manager.firstName} ${employee.manager.lastName}`.trim() : null,
    workLocation: formatWorkLocation(employee?.city ?? null, employee?.country ?? null, employee?.workArrangement ?? null),
    accountStatus: employee ? (formatEmployeeStatus(employee.status) ?? employee.status) : admin.active ? "Active" : "Inactive",
  };
}

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    const profile = await buildProfilePayload(admin);

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    console.error("Failed to load current profile:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to load your profile.",
      },
      { status: 401 },
    );
  }
}

/* ============================================================================
   PATCH /api/admin/me

   Self-service edit — allow-lists exactly four personal fields.
   Explicitly never accepts role, department, employment dates/status,
   manager, or employee ref from the client, even if present in the
   body — those stay the Team/HR system's single source of truth.
============================================================================ */

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();

    const employee = await prisma.employee.findUnique({ where: { adminUserId: admin.id }, select: { id: true } });
    if (!employee) {
      return NextResponse.json({ ok: false, error: "No employment record is linked to this account." }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const data: { preferredName?: string | null; phone?: string | null; city?: string | null; country?: string | null } = {};

    if ("preferredName" in body) data.preferredName = typeof body.preferredName === "string" ? body.preferredName.trim() || null : null;
    if ("phone" in body) data.phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
    if ("city" in body) data.city = typeof body.city === "string" ? body.city.trim() || null : null;
    if ("country" in body) data.country = typeof body.country === "string" ? body.country.trim() || null : null;

    await prisma.employee.update({ where: { id: employee.id }, data });

    const profile = await buildProfilePayload(admin);

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    console.error("Failed to update current profile:", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    return NextResponse.json({ ok: false, error: "Unable to update your profile." }, { status: 500 });
  }
}