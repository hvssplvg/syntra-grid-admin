import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  contractApiError,
  contractDTO,
  optionalText,
  replaceContractDocument,
  requireContractIdentity,
  requiredText,
} from "@/lib/contracts/server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    contractId: string;
  }>;
};

/* =============================================================================
 * PUT
 * =============================================================================
 */

export async function PUT(
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

    const name =
      requiredText(
        body.name,
        "Document name",
      );

    const url =
      requiredText(
        body.url,
        "Document URL",
      );

    const sizeBytes =
      optionalBigInt(
        body.sizeBytes,
        "Document size",
      );

    const contract =
      await replaceContractDocument({
        identity,

        contractId:
          id,

        name,
        url,

        mimeType:
          optionalText(
            body.mimeType,
            "Document MIME type",
          ),

        sizeBytes,
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
 * REQUEST BODY
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
   * Handle JavaScript numbers separately so that values which have
   * already lost integer precision are rejected before conversion.
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
   * JSON cannot directly represent bigint values, so decimal strings
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
   * Only unsigned whole-number strings are valid.
   *
   * Rejects values such as:
   * - "-1"
   * - "1.5"
   * - "1e5"
   * - "abc"
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
     * Do not use the 0n literal because this project's TypeScript
     * target is currently below ES2020.
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