import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  deleteInvoice,
  invoiceApiError,
  invoiceDTO,
  optionalDateTime,
  optionalMoney,
  optionalText,
  parseCurrencyCode,
  requireInvoice,
  requireInvoiceIdentity,
  updateInvoice,
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
  _request: NextRequest,
  context: {
    params: Promise<{
      invoiceId: string;
    }>;
  },
) {
  try {
    await requireInvoiceIdentity();

    const { invoiceId } =
      await context.params;

    const invoice =
      await requireInvoice(
        invoiceId,
      );

    return NextResponse.json(
      {
        invoice:
          invoiceDTO(
            invoice,
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
  context: {
    params: Promise<{
      invoiceId: string;
    }>;
  },
) {
  try {
    const identity =
      await requireInvoiceIdentity();

    const { invoiceId } =
      await context.params;

    const body =
      await readJsonBody(
        request,
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
      body.subtotal ===
      undefined
        ? undefined
        : optionalMoney(
            body.subtotal,
            "Subtotal",
          );

    const tax =
      body.tax ===
      undefined
        ? undefined
        : optionalMoney(
            body.tax,
            "Tax",
          );

    /* =========================================================================
     * DATES
     * =========================================================================
     */

    const issuedAt =
      body.issuedAt ===
      undefined
        ? undefined
        : optionalDateTime(
            body.issuedAt,
            "Issue date",
          );

    const dueAt =
      body.dueAt ===
      undefined
        ? undefined
        : optionalDateTime(
            body.dueAt,
            "Due date",
          );

    /* =========================================================================
     * UPDATE
     * =========================================================================
     */

    const invoice =
      await updateInvoice({
        identity,

        invoiceId,

        input: {
          ...(typeof body.clientId ===
          "string"
            ? {
                clientId:
                  body.clientId,
              }
            : {}),

          ...(body.description !==
          undefined
            ? {
                description:
                  optionalText(
                    body.description,
                    "Description",
                  ),
              }
            : {}),

          ...(currency !==
          undefined
            ? {
                currency,
              }
            : {}),

          ...(subtotal !==
          undefined
            ? {
                subtotal,
              }
            : {}),

          ...(tax !==
          undefined
            ? {
                tax,
              }
            : {}),

          ...(issuedAt !==
          undefined
            ? {
                issuedAt,
              }
            : {}),

          ...(dueAt !==
          undefined
            ? {
                dueAt,
              }
            : {}),
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
  context: {
    params: Promise<{
      invoiceId: string;
    }>;
  },
) {
  try {
    const identity =
      await requireInvoiceIdentity();

    const { invoiceId } =
      await context.params;

    const result =
      await deleteInvoice({
        identity,

        invoiceId,
      });

    return NextResponse.json(
      result,
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
