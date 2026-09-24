import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getWorkloadFeed,
  parseWorkloadRange,
  requireWorkloadIdentity,
  workloadApiError,
} from "@/lib/workload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =============================================================================
 * GET /api/admin/workload
 * =============================================================================
 *
 * Workload dashboard feed.
 *
 * Date semantics:
 *
 * start = inclusive
 * end   = exclusive
 *
 * Example:
 *
 * start=2026-09-21
 * end=2026-09-28
 *
 * means:
 *
 * Monday 21 September
 * through
 * Sunday 27 September
 * =============================================================================
 */

export async function GET(
  request: NextRequest,
) {
  try {
    const identity =
      await requireWorkloadIdentity();

    const searchParams =
      request.nextUrl.searchParams;

    const start =
      searchParams.get("start");

    const end =
      searchParams.get("end");

    const employeeId =
      cleanOptionalParam(
        searchParams.get(
          "employeeId",
        ),
      );

    const departmentId =
      cleanOptionalParam(
        searchParams.get(
          "departmentId",
        ),
      );

    const clientId =
      cleanOptionalParam(
        searchParams.get(
          "clientId",
        ),
      );

    const projectId =
      cleanOptionalParam(
        searchParams.get(
          "projectId",
        ),
      );

    const range =
      parseWorkloadRange(
        start,
        end,
      );

    const feed =
      await getWorkloadFeed({
        identity,
        range,

        employeeId,
        departmentId,
        clientId,
        projectId,
      });

    return NextResponse.json({
      viewer: {
        adminId:
          identity.admin.id,

        employeeId:
          identity.employee.id,

        role:
          identity.admin.role,

        isWorkloadManager:
          identity.isWorkloadManager,
      },

      range: {
        start:
          range.start.toISOString(),

        end:
          range.end.toISOString(),
      },

      filters: {
        employeeId,
        departmentId,
        clientId,
        projectId,
      },

      ...feed,
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/workload]",
      error,
    );

    const result =
      workloadApiError(error);

    return NextResponse.json(
      {
        error:
          result.message,
      },
      {
        status:
          result.status,
      },
    );
  }
}

/* =============================================================================
 * HELPERS
 * =============================================================================
 */

function cleanOptionalParam(
  value: string | null,
): string | null {
  const cleaned =
    value?.trim();

  if (!cleaned) {
    return null;
  }

  return cleaned;
}