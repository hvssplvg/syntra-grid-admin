import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  contractApiError,
  contractDTO,
  optionalDateTime,
  optionalMoney,
  optionalNonNegativeInteger,
  optionalText,
  requireContractIdentity,
  requiredText,
  renewContract,
} from "@/lib/contracts/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    contractId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireContractIdentity();

    const { contractId } =
      await context.params;

    const id =
      requiredText(
        contractId,
        "Contract ID",
      );

    const body =
      await readJsonBody(
        request,
      );

    const startDate =
      requiredDateTime(
        body.startDate,
        "Start date",
      );

    const endDate =
      requiredDateTime(
        body.endDate,
        "End date",
      );

    const renewalAt =
      optionalDateTime(
        body.renewalAt,
        "Renewal date",
      );

    const value =
      body.value === undefined
        ? undefined
        : optionalMoney(
            body.value,
            "Contract value",
          );

    const billingCycle =
      body.billingCycle ===
      undefined
        ? undefined
        : optionalText(
            body.billingCycle,
            "Billing cycle",
          );

    const autoRenew =
      body.autoRenew ===
      undefined
        ? undefined
        : requiredBoolean(
            body.autoRenew,
            "Auto renew",
          );

    const noticePeriodDays =
      body.noticePeriodDays ===
      undefined
        ? undefined
        : optionalNonNegativeInteger(
            body.noticePeriodDays,
            "Notice period",
          );

    const contract =
      await renewContract({
        identity,
        contractId: id,

        startDate,
        endDate,
        renewalAt,

        ...(value !== undefined
          ? {
              value,
            }
          : {}),

        ...(billingCycle !==
        undefined
          ? {
              billingCycle,
            }
          : {}),

        ...(autoRenew !==
        undefined
          ? {
              autoRenew,
            }
          : {}),

        ...(noticePeriodDays !==
        undefined
          ? {
              noticePeriodDays,
            }
          : {}),
      });

    return NextResponse.json(
      {
        contract:
          contractDTO(
            contract,
            identity,
          ),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

async function readJsonBody(
  request: NextRequest,
): Promise<
  Record<string, unknown>
> {
  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    throw new Error(
      "Request body must contain valid JSON.",
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new Error(
      "Request body must be a JSON object.",
    );
  }

  return body as Record<
    string,
    unknown
  >;
}

function requiredDateTime(
  value: unknown,
  label: string,
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `${label} is required.`,
    );
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      `${label} must be a valid date and time.`,
    );
  }

  return date;
}

function requiredBoolean(
  value: unknown,
  label: string,
) {
  if (
    typeof value !== "boolean"
  ) {
    throw new Error(
      `${label} must be true or false.`,
    );
  }

  return value;
}

function errorResponse(
  error: unknown,
) {
  const result =
    contractApiError(error);

  return NextResponse.json(
    {
      error: result.message,
    },
    {
      status: result.status,
    },
  );
}