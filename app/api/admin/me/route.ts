import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

export async function GET() {
  try {
    const admin = await getCurrentAdmin();

    const employee = await prisma.employee.findUnique({
      where: {
        adminUserId: admin.id,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        jobTitle: true,
        avatarUrl: true,
        workEmail: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      profile: {
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
      },
    });
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