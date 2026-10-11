import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createInvoice,
  invoiceApiError,
  invoiceDTO,
  getInvoiceFeed,
  optionalDateTime,
  optionalMoney,
  optionalText,
  parseCurrencyCode,
  parseInvoiceSort,
  parseInvoiceStatus,
  requireInvoiceIdentity,
  requiredText,
} from "@/lib/invoices/server";

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
    /*
     * Require a valid admin identity before exposing invoice data.
     */
    await requireInvoiceIdentity();

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

    const statusValue =
      searchParams.get(
        "status",
      );

    const currencyValue =
      searchParams.get(
        "currency",
      );

    const overdueValue =
      searchParams.get(
        "overdue",
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

    /* =========================================================================
     * PAGINATION
     * =========================================================================
     */

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

    /* =========================================================================
     * FILTERS
     * =========================================================================
     */

    const status =
      statusValue
        ? parseInvoiceStatus(
            statusValue,
          )
        : null;

    const currency =
      currencyValue
        ? parseCurrencyCode(
            currencyValue,
          )
        : null;

    const overdue =
      parseOptionalBooleanQuery(
        overdueValue,
        "Overdue",
      );

    /* =========================================================================
     * FEED
     * =========================================================================
     */

    const feed =
      await getInvoiceFeed({
        filters: {
          search,

          clientId,

          status,

          currency,

          overdue,

          page:
            page ??
            undefined,

          pageSize:
            pageSize ??
            undefined,

          sort:
            parseInvoiceSort(
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
      await requireInvoiceIdentity();

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
     * MONEY
     * =========================================================================
     */

    const subtotal =
      optionalMoney(
        body.subtotal,
        "Subtotal",
      );

    const tax =
      optionalMoney(
        body.tax,
        "Tax",
      );

    /* =========================================================================
     * DATES
     * =========================================================================
     */

    const issuedAt =
      optionalDateTime(
        body.issuedAt,
        "Issue date",
      );

    const dueAt =
      optionalDateTime(
        body.dueAt,
        "Due date",
      );

    /* =========================================================================
     * CREATE
     * =========================================================================
     */

    const invoice =
      await createInvoice({
        identity,

        input: {
          clientId,

          description:
            optionalText(
              body.description,
              "Description",
            ),

          ...(currency
            ? {
                currency,
              }
            : {}),

          subtotal,

          tax,

          issuedAt,
          dueAt,
        },
      });

    /* =========================================================================
     * RESPONSE
     * =========================================================================
     */

    return NextResponse.json(
      {
        invoice:
          invoiceDTO(
            invoice,
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
 * JSON BODY
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
): number | null {
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
 * OPTIONAL BOOLEAN QUERY
 * =============================================================================
 */

function parseOptionalBooleanQuery(
  value: string | null,
  label: string,
): boolean | null {
  if (
    value === null ||
    value === ""
  ) {
    return null;
  }

  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    normalized ===
    "true"
  ) {
    return true;
  }

  if (
    normalized ===
    "false"
  ) {
    return false;
  }

  throw new Error(
    `${label} must be true or false.`,
  );
}

/* =============================================================================
 * ERROR RESPONSE
 * =============================================================================
 */

function errorResponse(
  error: unknown,
) {
  const result =
    invoiceApiError(
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