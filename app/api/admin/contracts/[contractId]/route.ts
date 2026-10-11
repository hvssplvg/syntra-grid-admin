import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  contractApiError,
  contractDTO,
  deleteContract,
  optionalDateTime,
  optionalMoney,
  optionalNonNegativeInteger,
  optionalText,
  parseContractType,
  parseCurrencyCode,
  requireContract,
  requireContractIdentity,
  requiredText,
  updateContract,
} from "@/lib/contracts/server";

/* =============================================================================
 * ROUTE CONFIG
 * =============================================================================
 */

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type RouteContext = {
  params: Promise<{
    contractId: string;
  }>;
};

/* =============================================================================
 * GET
 * =============================================================================
 */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireContractIdentity();

    const {
      contractId,
    } =
      await context.params;

    const id =
      requiredText(
        contractId,
        "Contract ID",
      );

    const contract =
      await requireContract(
        id,
      );

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
    return errorResponse(
      error,
    );
  }
}

/* =============================================================================
 * PATCH
 * =============================================================================
 */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireContractIdentity();

    const {
      contractId,
    } =
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

    /*
     * PATCH semantics:
     *
     * undefined = field was not supplied, so leave it unchanged.
     * null      = caller explicitly wants to clear a nullable field.
     */

    const title =
      body.title ===
      undefined
        ? undefined
        : requiredText(
            body.title,
            "Contract title",
          );

    const description =
      body.description ===
      undefined
        ? undefined
        : optionalText(
            body.description,
            "Description",
          );

    const type =
      body.type ===
      undefined
        ? undefined
        : parseContractType(
            body.type,
          );

    const projectId =
      body.projectId ===
      undefined
        ? undefined
        : optionalText(
            body.projectId,
            "Project",
          );

    const value =
      body.value ===
      undefined
        ? undefined
        : optionalMoney(
            body.value,
            "Contract value",
          );

    const currency =
      body.currency ===
      undefined
        ? undefined
        : parseCurrencyCode(
            body.currency,
          );

    const billingCycle =
      body.billingCycle ===
      undefined
        ? undefined
        : optionalText(
            body.billingCycle,
            "Billing cycle",
          );

    const startDate =
      body.startDate ===
      undefined
        ? undefined
        : optionalDateTime(
            body.startDate,
            "Start date",
          );

    const endDate =
      body.endDate ===
      undefined
        ? undefined
        : optionalDateTime(
            body.endDate,
            "End date",
          );

    const renewalAt =
      body.renewalAt ===
      undefined
        ? undefined
        : optionalDateTime(
            body.renewalAt,
            "Renewal date",
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

    const signedAt =
      body.signedAt ===
      undefined
        ? undefined
        : optionalDateTime(
            body.signedAt,
            "Signed date",
          );

    const signedByClientName =
      body.signedByClientName ===
      undefined
        ? undefined
        : optionalText(
            body.signedByClientName,
            "Client signatory",
          );

    const signedByCompanyName =
      body.signedByCompanyName ===
      undefined
        ? undefined
        : optionalText(
            body.signedByCompanyName,
            "Company signatory",
          );

    const documentName =
      body.documentName ===
      undefined
        ? undefined
        : optionalText(
            body.documentName,
            "Document name",
          );

    const documentUrl =
      body.documentUrl ===
      undefined
        ? undefined
        : optionalText(
            body.documentUrl,
            "Document URL",
          );

    const documentMimeType =
      body.documentMimeType ===
      undefined
        ? undefined
        : optionalText(
            body.documentMimeType,
            "Document MIME type",
          );

    const documentSizeBytes =
      body.documentSizeBytes ===
      undefined
        ? undefined
        : optionalBigInt(
            body.documentSizeBytes,
            "Document size",
          );

    const notes =
      body.notes ===
      undefined
        ? undefined
        : optionalText(
            body.notes,
            "Notes",
          );

    const contract =
      await updateContract({
        identity,

        contractId:
          id,

        input: {
          ...(title !==
          undefined
            ? {
                title,
              }
            : {}),

          ...(description !==
          undefined
            ? {
                description,
              }
            : {}),

          ...(type !==
          undefined
            ? {
                type,
              }
            : {}),

          ...(projectId !==
          undefined
            ? {
                projectId,
              }
            : {}),

          ...(value !==
          undefined
            ? {
                value,
              }
            : {}),

          ...(currency !==
          undefined
            ? {
                currency,
              }
            : {}),

          ...(billingCycle !==
          undefined
            ? {
                billingCycle,
              }
            : {}),

          ...(startDate !==
          undefined
            ? {
                startDate,
              }
            : {}),

          ...(endDate !==
          undefined
            ? {
                endDate,
              }
            : {}),

          ...(renewalAt !==
          undefined
            ? {
                renewalAt,
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

          ...(signedAt !==
          undefined
            ? {
                signedAt,
              }
            : {}),

          ...(signedByClientName !==
          undefined
            ? {
                signedByClientName,
              }
            : {}),

          ...(signedByCompanyName !==
          undefined
            ? {
                signedByCompanyName,
              }
            : {}),

          ...(documentName !==
          undefined
            ? {
                documentName,
              }
            : {}),

          ...(documentUrl !==
          undefined
            ? {
                documentUrl,
              }
            : {}),

          ...(documentMimeType !==
          undefined
            ? {
                documentMimeType,
              }
            : {}),

          ...(documentSizeBytes !==
          undefined
            ? {
                documentSizeBytes,
              }
            : {}),

          ...(notes !==
          undefined
            ? {
                notes,
              }
            : {}),
        },
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
    return errorResponse(
      error,
    );
  }
}

/* =============================================================================
 * DELETE
 * =============================================================================
 */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireContractIdentity();

    const {
      contractId,
    } =
      await context.params;

    const id =
      requiredText(
        contractId,
        "Contract ID",
      );

    const deleted =
      await deleteContract({
        identity,

        contractId:
          id,
      });

    return NextResponse.json(
      {
        success: true,

        contract:
          deleted,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    return errorResponse(
      error,
    );
  }
}

/* =============================================================================
 * REQUEST HELPERS
 * =============================================================================
 */

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
    typeof body !==
      "object" ||
    Array.isArray(
      body,
    )
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

/* =============================================================================
 * BOOLEAN
 * =============================================================================
 */

function requiredBoolean(
  value: unknown,
  label: string,
): boolean {
  if (
    typeof value !==
    "boolean"
  ) {
    throw new Error(
      `${label} must be true or false.`,
    );
  }

  return value;
}

/* =============================================================================
 * OPTIONAL BIGINT
 * =============================================================================
 */

function optionalBigInt(
  value: unknown,
  label: string,
): bigint | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  /*
   * Handle number input separately so we can reject numbers
   * which have already exceeded JavaScript's safe integer range.
   */
  if (
    typeof value ===
    "number"
  ) {
    if (
      !Number.isSafeInteger(
        value,
      ) ||
      value < 0
    ) {
      throw new Error(
        `${label} must be a non-negative whole number.`,
      );
    }

    return BigInt(
      value,
    );
  }

  /*
   * JSON cannot represent bigint directly, so decimal strings
   * are also accepted.
   */
  if (
    typeof value !==
    "string"
  ) {
    throw new Error(
      `${label} must be a non-negative whole number.`,
    );
  }

  const trimmed =
    value.trim();

  /*
   * Only unsigned integer strings are accepted.
   *
   * Valid:
   * "0"
   * "1024"
   * "5000000"
   *
   * Invalid:
   * "-1"
   * "1.5"
   * "1e6"
   * "abc"
   */
  if (
    !/^\d+$/.test(
      trimmed,
    )
  ) {
    throw new Error(
      `${label} must be a non-negative whole number.`,
    );
  }

  try {
    const parsed =
      BigInt(
        trimmed,
      );

    /*
     * BigInt(0) is used instead of 0n because the project's
     * current TypeScript target is lower than ES2020.
     */
    if (
      parsed <
      BigInt(0)
    ) {
      throw new Error(
        `${label} must be a non-negative whole number.`,
      );
    }

    return parsed;
  } catch {
    throw new Error(
      `${label} must be a non-negative whole number.`,
    );
  }
}

/* =============================================================================
 * ERROR RESPONSE
 * =============================================================================
 */

function errorResponse(
  error: unknown,
) {
  const result =
    contractApiError(
      error,
    );

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