import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  contractApiError,
  contractDTO,
  createContract,
  getContractFeed,
  optionalBoolean,
  optionalDateTime,
  optionalMoney,
  optionalNonNegativeInteger,
  optionalText,
  parseContractSort,
  parseContractStatus,
  parseContractType,
  parseCurrencyCode,
  requireContractIdentity,
  requiredText,
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
 * GET
 * =============================================================================
 */

export async function GET(
  request: NextRequest,
) {
  try {

    const searchParams =
      request.nextUrl.searchParams;

    const search =
      searchParams.get(
        "search",
      );

    const clientId =
      searchParams.get(
        "clientId",
      );

    const projectId =
      searchParams.get(
        "projectId",
      );

    const typeValue =
      searchParams.get(
        "type",
      );

    const statusValue =
      searchParams.get(
        "status",
      );

    const currencyValue =
      searchParams.get(
        "currency",
      );

    const pageValue =
      searchParams.get(
        "page",
      );

    const pageSizeValue =
      searchParams.get(
        "pageSize",
      );

    const sortValue =
      searchParams.get(
        "sort",
      );

    const page =
      parsePositiveIntegerQuery(
        pageValue,
        "Page",
      );

    const pageSize =
      parsePositiveIntegerQuery(
        pageSizeValue,
        "Page size",
      );

    const feed =
      await getContractFeed({
        filters: {
          search,

          clientId,
          projectId,

          type:
            typeValue
              ? parseContractType(
                  typeValue,
                )
              : null,

          status:
            parseContractStatus(
              statusValue,
            ),

          currency:
            currencyValue
              ? parseCurrencyCode(
                  currencyValue,
                )
              : null,

          page:
            page ??
            undefined,

          pageSize:
            pageSize ??
            undefined,

          sort:
            parseContractSort(
              sortValue,
            ),
        },
      });

    return NextResponse.json(
      feed,
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
 * POST
 * =============================================================================
 */

export async function POST(
  request: NextRequest,
) {
  try {
    const identity =
      await requireContractIdentity();

    const body =
      await readJsonBody(
        request,
      );

    /* =========================================================================
     * REQUIRED FIELDS
     * =========================================================================
     */

    const clientId =
      requiredText(
        body.clientId,
        "Client",
      );

    const title =
      requiredText(
        body.title,
        "Contract title",
      );

    const type =
      parseContractType(
        body.type,
      );

    /* =========================================================================
     * OPTIONAL ENUMS
     * =========================================================================
     */

    const currency =
      body.currency ===
        undefined ||
      body.currency ===
        null ||
      body.currency ===
        ""
        ? undefined
        : parseCurrencyCode(
            body.currency,
          );

    /* =========================================================================
     * OPTIONAL NUMBERS
     * =========================================================================
     */

    const value =
      optionalMoney(
        body.value,
        "Contract value",
      );

    const noticePeriodDays =
      optionalNonNegativeInteger(
        body.noticePeriodDays,
        "Notice period",
      );

    /* =========================================================================
     * OPTIONAL DATES
     * =========================================================================
     */

    const startDate =
      optionalDateTime(
        body.startDate,
        "Start date",
      );

    const endDate =
      optionalDateTime(
        body.endDate,
        "End date",
      );

    const renewalAt =
      optionalDateTime(
        body.renewalAt,
        "Renewal date",
      );

    const signedAt =
      optionalDateTime(
        body.signedAt,
        "Signed date",
      );

    /* =========================================================================
     * DOCUMENT SIZE
     * =========================================================================
     */

    const documentSizeBytes =
      optionalBigInt(
        body.documentSizeBytes,
        "Document size",
      );

    /* =========================================================================
     * CREATE CONTRACT
     * =========================================================================
     */

    const contract =
      await createContract({
        identity,

        input: {
          clientId,

          projectId:
            optionalText(
              body.projectId,
              "Project",
            ),

          title,

          description:
            optionalText(
              body.description,
              "Description",
            ),

          type,

          value,

          ...(currency
            ? {
                currency,
              }
            : {}),

          billingCycle:
            optionalText(
              body.billingCycle,
              "Billing cycle",
            ),

          startDate,
          endDate,
          renewalAt,

          autoRenew:
            optionalBoolean(
              body.autoRenew,
              false,
            ),

          noticePeriodDays,

          signedAt,

          signedByClientName:
            optionalText(
              body.signedByClientName,
              "Client signatory",
            ),

          signedByCompanyName:
            optionalText(
              body.signedByCompanyName,
              "Company signatory",
            ),

          documentName:
            optionalText(
              body.documentName,
              "Document name",
            ),

          documentUrl:
            optionalText(
              body.documentUrl,
              "Document URL",
            ),

          documentMimeType:
            optionalText(
              body.documentMimeType,
              "Document MIME type",
            ),

          documentSizeBytes,

          notes:
            optionalText(
              body.notes,
              "Notes",
            ),
        },
      });

    /* =========================================================================
     * RESPONSE
     * =========================================================================
     */

    return NextResponse.json(
      {
        contract:
          contractDTO(
            contract,
            identity,
          ),
      },
      {
        status: 201,
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
 * POSITIVE INTEGER QUERY
 * =============================================================================
 */

function parsePositiveIntegerQuery(
  value: string | null,
  label: string,
) {
  if (
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <= 0
  ) {
    throw new Error(
      `${label} must be a positive whole number.`,
    );
  }

  return parsed;
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
   * Numbers must be safe integers before being converted to BigInt.
   *
   * This prevents values that have already lost precision in JavaScript
   * from silently being stored incorrectly.
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
   * JSON does not natively support BigInt, so string input is also
   * accepted. This is useful if the frontend sends a large file size
   * as a decimal string.
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
   * Only unsigned decimal integer strings are accepted.
   *
   * This prevents values such as:
   * 1.5
   * -1
   * 1e5
   * abc
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
     * Use BigInt(0) rather than the 0n literal because this project
     * currently targets a JavaScript version below ES2020.
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
  console.error(
    "[Contracts API Error]",
    error,
  );

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