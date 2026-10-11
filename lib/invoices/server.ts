import "server-only";

import {
  InvoiceStatus,
  CurrencyCode,
  Prisma,
  type AdminRole,
} from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const DEFAULT_CURRENCY: CurrencyCode =
  CurrencyCode.GBP;

const ZERO_DECIMAL =
  new Prisma.Decimal(0);

/* =============================================================================
 * TYPES
 * =============================================================================
 */

export type InvoiceSort =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "issued_desc"
  | "issued_asc"
  | "due_desc"
  | "due_asc"
  | "total_desc"
  | "total_asc";

export type InvoiceIdentity = {
  id: string;
  email: string;
  role: AdminRole;
};

export type InvoiceFeedFilters = {
  search?: string | null;

  clientId?: string | null;

  status?:
    | InvoiceStatus
    | null;

  currency?:
    | CurrencyCode
    | null;

  overdue?: boolean | null;

  page?: number;
  pageSize?: number;

  sort?: InvoiceSort | null;
};

export type CreateInvoiceInput = {
  clientId: string;

  description?: string | null;

  currency?: CurrencyCode;

  subtotal?: Prisma.Decimal | null;
  tax?: Prisma.Decimal | null;

  issuedAt?: Date | null;
  dueAt?: Date | null;
};

export type UpdateInvoiceInput = {
  clientId?: string;

  description?:
    | string
    | null;

  currency?: CurrencyCode;

  subtotal?:
    | Prisma.Decimal
    | null;

  tax?:
    | Prisma.Decimal
    | null;

  issuedAt?:
    | Date
    | null;

  dueAt?:
    | Date
    | null;
};

export type RecordInvoicePaymentInput = {
  amount: Prisma.Decimal;

  paidAt?: Date | null;
};

/* =============================================================================
 * PRISMA INCLUDE
 * =============================================================================
 */

const invoiceInclude = {
  client: {
    select: {
      id: true,
      name: true,
      displayName: true,
      clientRef: true,
      logoUrl: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
    },
  },

  matchedMonzoTransactions: {
    select: {
      id: true,
      monzoTransactionId: true,
      amountMinor: true,
      currency: true,
      description: true,
      merchantName: true,
      counterpartyName: true,
      createdAtMonzo: true,
      settledAt: true,
      matchStatus: true,
    },

    orderBy: {
      createdAtMonzo:
        "desc" as const,
    },
  },

  timesheetEntries: {
    select: {
      id: true,
      workDate: true,
      title: true,
      description: true,
      hours: true,
      billable: true,
      billedAt: true,

      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
        },
      },

      project: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },

    orderBy: {
      workDate:
        "desc" as const,
    },
  },
} satisfies Prisma.ClientInvoiceInclude;

type InvoiceRecord =
  Prisma.ClientInvoiceGetPayload<{
    include: typeof invoiceInclude;
  }>;

/* =============================================================================
 * ERROR CLASS
 * =============================================================================
 */

export class InvoiceApiError extends Error {
  status: number;

  constructor(
    status: number,
    message: string,
  ) {
    super(message);

    this.name =
      "InvoiceApiError";

    this.status =
      status;
  }
}

/* =============================================================================
 * ERROR HANDLING
 * =============================================================================
 */

export function invoiceApiError(
  error: unknown,
): {
  status: number;
  message: string;
} {
  if (
    error instanceof
    InvoiceApiError
  ) {
    return {
      status: error.status,
      message: error.message,
    };
  }

  if (
    error instanceof
    Prisma.PrismaClientKnownRequestError
  ) {
    if (
      error.code ===
      "P2025"
    ) {
      return {
        status: 404,
        message:
          "The requested invoice could not be found.",
      };
    }

    if (
      error.code ===
      "P2002"
    ) {
      return {
        status: 409,
        message:
          "An invoice with the same unique value already exists.",
      };
    }

    if (
      error.code ===
      "P2003"
    ) {
      return {
        status: 400,
        message:
          "The invoice references a record that does not exist.",
      };
    }
  }

  console.error(
    "[Invoices API Error]",
    error,
  );

  return {
    status: 400,
    message:
      error instanceof Error
        ? error.message
        : "Something went wrong while processing the invoice.",
  };
}

/* =============================================================================
 * IDENTITY
 * =============================================================================
 */

export async function requireInvoiceIdentity(): Promise<InvoiceIdentity> {
  /*
   * Keep invoice authentication aligned with the rest of your admin backend.
   *
   * Your AdminUser records are already connected to authentication through
   * authUserId. Because this file cannot safely guess which authentication
   * helper your existing application uses, resolve the current AdminUser
   * using the same mechanism used by lib/contracts/server.ts.
   *
   * If contracts/server.ts already exports a reusable identity helper,
   * replace this implementation with that helper.
   */

  const {
    requireContractIdentity,
  } =
    await import(
      "@/lib/contracts/server"
    );

  const identity =
    await requireContractIdentity();

  return {
    id: identity.id,
    email: identity.email,
    role: identity.role,
  };
}

/* =============================================================================
 * BASIC VALIDATION
 * =============================================================================
 */

export function requiredText(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !==
    "string"
  ) {
    throw new InvoiceApiError(
      400,
      `${label} is required.`,
    );
  }

  const trimmed =
    value.trim();

  if (!trimmed) {
    throw new InvoiceApiError(
      400,
      `${label} is required.`,
    );
  }

  return trimmed;
}

export function optionalText(
  value: unknown,
  label: string,
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
    "string"
  ) {
    throw new InvoiceApiError(
      400,
      `${label} must be text.`,
    );
  }

  const trimmed =
    value.trim();

  return trimmed || null;
}

export function optionalBoolean(
  value: unknown,
  fallback = false,
): boolean {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value !==
    "boolean"
  ) {
    throw new InvoiceApiError(
      400,
      "Expected a true or false value.",
    );
  }

  return value;
}

/* =============================================================================
 * MONEY VALIDATION
 * =============================================================================
 */

export function optionalMoney(
  value: unknown,
  label: string,
): Prisma.Decimal | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
      "string" &&
    typeof value !==
      "number"
  ) {
    throw new InvoiceApiError(
      400,
      `${label} must be a valid amount.`,
    );
  }

  const raw =
    typeof value === "string"
      ? value.trim()
      : String(value);

  if (
    !/^\d+(\.\d{1,2})?$/.test(
      raw,
    )
  ) {
    throw new InvoiceApiError(
      400,
      `${label} must be a non-negative amount with no more than two decimal places.`,
    );
  }

  try {
    const amount =
      new Prisma.Decimal(
        raw,
      );

    if (
      amount.lessThan(0)
    ) {
      throw new Error();
    }

    return amount;
  } catch {
    throw new InvoiceApiError(
      400,
      `${label} must be a valid non-negative amount.`,
    );
  }
}

export function requiredMoney(
  value: unknown,
  label: string,
): Prisma.Decimal {
  const amount =
    optionalMoney(
      value,
      label,
    );

  if (amount === null) {
    throw new InvoiceApiError(
      400,
      `${label} is required.`,
    );
  }

  return amount;
}

/* =============================================================================
 * DATE VALIDATION
 * =============================================================================
 */

export function optionalDateTime(
  value: unknown,
  label: string,
): Date | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
      "string" &&
    !(value instanceof Date)
  ) {
    throw new InvoiceApiError(
      400,
      `${label} must be a valid date.`,
    );
  }

  const parsed =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    throw new InvoiceApiError(
      400,
      `${label} must be a valid date.`,
    );
  }

  return parsed;
}

/* =============================================================================
 * ENUM PARSERS
 * =============================================================================
 */

export function parseInvoiceStatus(
  value: unknown,
): InvoiceStatus | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
    "string"
  ) {
    throw new InvoiceApiError(
      400,
      "Invoice status is invalid.",
    );
  }

  const normalized =
    value
      .trim()
      .toUpperCase();

  if (
    !Object.values(
      InvoiceStatus,
    ).includes(
      normalized as InvoiceStatus,
    )
  ) {
    throw new InvoiceApiError(
      400,
      "Invoice status is invalid.",
    );
  }

  return normalized as InvoiceStatus;
}

export function parseCurrencyCode(
  value: unknown,
): CurrencyCode {
  if (
    typeof value !==
    "string"
  ) {
    throw new InvoiceApiError(
      400,
      "Currency is invalid.",
    );
  }

  const normalized =
    value
      .trim()
      .toUpperCase();

  if (
    !Object.values(
      CurrencyCode,
    ).includes(
      normalized as CurrencyCode,
    )
  ) {
    throw new InvoiceApiError(
      400,
      "Currency is invalid.",
    );
  }

  return normalized as CurrencyCode;
}

export function parseInvoiceSort(
  value: unknown,
): InvoiceSort {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "updated_desc";
  }

  if (
    typeof value !==
    "string"
  ) {
    throw new InvoiceApiError(
      400,
      "Invoice sort is invalid.",
    );
  }

  const allowed:
    InvoiceSort[] = [
      "updated_desc",
      "updated_asc",

      "created_desc",
      "created_asc",

      "issued_desc",
      "issued_asc",

      "due_desc",
      "due_asc",

      "total_desc",
      "total_asc",
    ];

  if (
    !allowed.includes(
      value as InvoiceSort,
    )
  ) {
    throw new InvoiceApiError(
      400,
      "Invoice sort is invalid.",
    );
  }

  return value as InvoiceSort;
}

/* =============================================================================
 * SERIALISATION
 * =============================================================================
 */

function decimalString(
  value:
    | Prisma.Decimal
    | null
    | undefined,
) {
  return value
    ? value.toFixed(2)
    : "0.00";
}

function bigintString(
  value:
    | bigint
    | null
    | undefined,
) {
  return value ===
    null ||
    value ===
      undefined
    ? null
    : value.toString();
}

function dateString(
  value:
    | Date
    | null
    | undefined,
) {
  return value
    ? value.toISOString()
    : null;
}

/* =============================================================================
 * DERIVED STATUS
 * =============================================================================
 */

export function getEffectiveInvoiceStatus(
  invoice: {
    status: InvoiceStatus;
    dueAt: Date | null;
    balance: Prisma.Decimal;
  },
): InvoiceStatus {
  if (
    invoice.status ===
      InvoiceStatus.PAID ||
    invoice.status ===
      InvoiceStatus.CANCELLED ||
    invoice.status ===
      InvoiceStatus.DRAFT
  ) {
    return invoice.status;
  }

  if (
    invoice.dueAt &&
    invoice.dueAt.getTime() <
      Date.now() &&
    invoice.balance.greaterThan(
      0,
    )
  ) {
    return InvoiceStatus.OVERDUE;
  }

  return invoice.status;
}

/* =============================================================================
 * DTO
 * =============================================================================
 */

export function invoiceDTO(
  invoice: InvoiceRecord,
) {
  const effectiveStatus =
    getEffectiveInvoiceStatus(
      invoice,
    );

  return {
    id:
      invoice.id,

    invoiceRef:
      invoice.invoiceRef,

    status:
      effectiveStatus,

    storedStatus:
      invoice.status,

    description:
      invoice.description,

    currency:
      invoice.currency,

    subtotal:
      decimalString(
        invoice.subtotal,
      ),

    tax:
      decimalString(
        invoice.tax,
      ),

    total:
      decimalString(
        invoice.total,
      ),

    paid:
      decimalString(
        invoice.paid,
      ),

    balance:
      decimalString(
        invoice.balance,
      ),

    issuedAt:
      dateString(
        invoice.issuedAt,
      ),

    dueAt:
      dateString(
        invoice.dueAt,
      ),

    paidAt:
      dateString(
        invoice.paidAt,
      ),

    createdAt:
      invoice.createdAt.toISOString(),

    updatedAt:
      invoice.updatedAt.toISOString(),

    client: {
      id:
        invoice.client.id,

      name:
        invoice.client.name,

      displayName:
        invoice.client.displayName,

      clientRef:
        invoice.client.clientRef,

      logoUrl:
        invoice.client.logoUrl,

      contactName:
        invoice.client.contactName,

      contactEmail:
        invoice.client.contactEmail,

      contactPhone:
        invoice.client.contactPhone,
    },

    transactions:
      invoice.matchedMonzoTransactions.map(
        (
          transaction,
        ) => ({
          id:
            transaction.id,

          monzoTransactionId:
            transaction.monzoTransactionId,

          amountMinor:
            bigintString(
              transaction.amountMinor,
            ),

          currency:
            transaction.currency,

          description:
            transaction.description,

          merchantName:
            transaction.merchantName,

          counterpartyName:
            transaction.counterpartyName,

          createdAt:
            transaction.createdAtMonzo.toISOString(),

          settledAt:
            dateString(
              transaction.settledAt,
            ),

          matchStatus:
            transaction.matchStatus,
        }),
      ),

    timesheetEntries:
      invoice.timesheetEntries.map(
        (
          entry,
        ) => ({
          id:
            entry.id,

          workDate:
            entry.workDate.toISOString(),

          title:
            entry.title,

          description:
            entry.description,

          hours:
            decimalString(
              entry.hours,
            ),

          billable:
            entry.billable,

          billedAt:
            dateString(
              entry.billedAt,
            ),

          employee: {
            id:
              entry.employee.id,

            firstName:
              entry.employee.firstName,

            lastName:
              entry.employee.lastName,

            preferredName:
              entry.employee.preferredName,
          },

          project:
            entry.project
              ? {
                  id:
                    entry.project.id,

                  name:
                    entry.project.name,

                  slug:
                    entry.project.slug,
                }
              : null,
        }),
      ),
  };
}

/* =============================================================================
 * REQUIRE CLIENT
 * =============================================================================
 */

async function requireClient(
  clientId: string,
) {
  const client =
    await prisma.client.findUnique({
      where: {
        id: clientId,
      },

      select: {
        id: true,
        name: true,
      },
    });

  if (!client) {
    throw new InvoiceApiError(
      404,
      "Client could not be found.",
    );
  }

  return client;
}

/* =============================================================================
 * REQUIRE INVOICE
 * =============================================================================
 */

export async function requireInvoice(
  invoiceId: string,
): Promise<InvoiceRecord> {
  const invoice =
    await prisma.clientInvoice.findUnique({
      where: {
        id: invoiceId,
      },

      include:
        invoiceInclude,
    });

  if (!invoice) {
    throw new InvoiceApiError(
      404,
      "Invoice could not be found.",
    );
  }

  return invoice;
}

/* =============================================================================
 * REFERENCE GENERATION
 * =============================================================================
 */

async function generateInvoiceReference() {
  const year =
    new Date().getUTCFullYear();

  const prefix =
    `INV-${year}-`;

  /*
   * We look up the latest invoice reference for the current year.
   *
   * This is considerably safer than using count(), because deleting a draft
   * invoice would otherwise allow an existing reference to be generated again.
   */

  const latest =
    await prisma.clientInvoice.findFirst({
      where: {
        invoiceRef: {
          startsWith:
            prefix,
        },
      },

      orderBy: {
        invoiceRef:
          "desc",
      },

      select: {
        invoiceRef:
          true,
      },
    });

  let next = 1;

  if (latest) {
    const suffix =
      latest.invoiceRef.slice(
        prefix.length,
      );

    const parsed =
      Number.parseInt(
        suffix,
        10,
      );

    if (
      Number.isInteger(
        parsed,
      )
    ) {
      next =
        parsed + 1;
    }
  }

  return (
    prefix +
    String(next).padStart(
      4,
      "0",
    )
  );
}

/* =============================================================================
 * TOTAL CALCULATION
 * =============================================================================
 */

function calculateInvoiceAmounts(
  subtotal:
    | Prisma.Decimal
    | null
    | undefined,
  tax:
    | Prisma.Decimal
    | null
    | undefined,
  paid:
    | Prisma.Decimal
    | null
    | undefined =
      ZERO_DECIMAL,
) {
  const safeSubtotal =
    subtotal ??
    ZERO_DECIMAL;

  const safeTax =
    tax ??
    ZERO_DECIMAL;

  const safePaid =
    paid ??
    ZERO_DECIMAL;

  const total =
    safeSubtotal.plus(
      safeTax,
    );

  const balance =
    Prisma.Decimal.max(
      total.minus(
        safePaid,
      ),
      ZERO_DECIMAL,
    );

  return {
    subtotal:
      safeSubtotal,

    tax:
      safeTax,

    total,

    paid:
      safePaid,

    balance,
  };
}

/* =============================================================================
 * WHERE BUILDER
 * =============================================================================
 */

function buildInvoiceWhere(
  filters: InvoiceFeedFilters,
): Prisma.ClientInvoiceWhereInput {
  const AND:
    Prisma.ClientInvoiceWhereInput[] =
      [];

  const search =
    filters.search?.trim();

  if (search) {
    AND.push({
      OR: [
        {
          invoiceRef: {
            contains:
              search,

            mode:
              "insensitive",
          },
        },

        {
          description: {
            contains:
              search,

            mode:
              "insensitive",
          },
        },

        {
          client: {
            is: {
              OR: [
                {
                  name: {
                    contains:
                      search,

                    mode:
                      "insensitive",
                  },
                },

                {
                  displayName: {
                    contains:
                      search,

                    mode:
                      "insensitive",
                  },
                },

                {
                  clientRef: {
                    contains:
                      search,

                    mode:
                      "insensitive",
                  },
                },

                {
                  contactName: {
                    contains:
                      search,

                    mode:
                      "insensitive",
                  },
                },

                {
                  contactEmail: {
                    contains:
                      search,

                    mode:
                      "insensitive",
                  },
                },
              ],
            },
          },
        },
      ],
    });
  }

  if (filters.clientId) {
    AND.push({
      clientId:
        filters.clientId,
    });
  }

  if (filters.currency) {
    AND.push({
      currency:
        filters.currency,
    });
  }

  /*
   * OVERDUE is treated as a derived state as well as a persisted enum.
   *
   * That means an invoice does not have to wait for a scheduled task before
   * appearing as overdue in the UI.
   */

  if (
    filters.status ===
    InvoiceStatus.OVERDUE
  ) {
    AND.push({
      status: {
        in: [
          InvoiceStatus.SENT,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.OVERDUE,
        ],
      },

      dueAt: {
        lt:
          new Date(),
      },

      balance: {
        gt:
          ZERO_DECIMAL,
      },
    });
  } else if (
    filters.status
  ) {
    AND.push({
      status:
        filters.status,
    });
  }

  if (
    filters.overdue ===
      true &&
    filters.status !==
      InvoiceStatus.OVERDUE
  ) {
    AND.push({
      status: {
        in: [
          InvoiceStatus.SENT,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.OVERDUE,
        ],
      },

      dueAt: {
        lt:
          new Date(),
      },

      balance: {
        gt:
          ZERO_DECIMAL,
      },
    });
  }

  if (AND.length === 0) {
    return {};
  }

  return {
    AND,
  };
}

/* =============================================================================
 * ORDER BUILDER
 * =============================================================================
 */

function buildInvoiceOrderBy(
  sort:
    | InvoiceSort
    | null
    | undefined,
): Prisma.ClientInvoiceOrderByWithRelationInput {
  switch (sort) {
    case "updated_asc":
      return {
        updatedAt:
          "asc",
      };

    case "created_desc":
      return {
        createdAt:
          "desc",
      };

    case "created_asc":
      return {
        createdAt:
          "asc",
      };

    case "issued_desc":
      return {
        issuedAt:
          "desc",
      };

    case "issued_asc":
      return {
        issuedAt:
          "asc",
      };

    case "due_desc":
      return {
        dueAt:
          "desc",
      };

    case "due_asc":
      return {
        dueAt:
          "asc",
      };

    case "total_desc":
      return {
        total:
          "desc",
      };

    case "total_asc":
      return {
        total:
          "asc",
      };

    case "updated_desc":
    default:
      return {
        updatedAt:
          "desc",
      };
  }
}

/* =============================================================================
 * FEED
 * =============================================================================
 */

export async function getInvoiceFeed({
  filters = {},
}: {
  filters?: InvoiceFeedFilters;
} = {}) {
  const page =
    Math.max(
      DEFAULT_PAGE,
      filters.page ??
        DEFAULT_PAGE,
    );

  const pageSize =
    Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        filters.pageSize ??
          DEFAULT_PAGE_SIZE,
      ),
    );

  const where =
    buildInvoiceWhere(
      filters,
    );

  const orderBy =
    buildInvoiceOrderBy(
      filters.sort,
    );

  const now =
    new Date();

  const [
    total,
    invoices,
    allSummary,
  ] =
    await Promise.all([
      prisma.clientInvoice.count({
        where,
      }),

      prisma.clientInvoice.findMany({
        where,

        include:
          invoiceInclude,

        orderBy,

        skip:
          (page - 1) *
          pageSize,

        take:
          pageSize,
      }),

      prisma.clientInvoice.findMany({
        select: {
          status:
            true,

          currency:
            true,

          total:
            true,

          paid:
            true,

          balance:
            true,

          dueAt:
            true,
        },
      }),
    ]);

  const pages =
    Math.max(
      1,
      Math.ceil(
        total /
          pageSize,
      ),
    );

  const summaryByCurrency =
    new Map<
      CurrencyCode,
      {
        invoiced: Prisma.Decimal;
        paid: Prisma.Decimal;
        outstanding: Prisma.Decimal;
        overdue: Prisma.Decimal;
      }
    >();

  let draftCount = 0;
  let sentCount = 0;
  let paidCount = 0;
  let partiallyPaidCount = 0;
  let overdueCount = 0;
  let cancelledCount = 0;

  for (
    const invoice of
    allSummary
  ) {
    const current =
      summaryByCurrency.get(
        invoice.currency,
      ) ?? {
        invoiced:
          new Prisma.Decimal(
            0,
          ),

        paid:
          new Prisma.Decimal(
            0,
          ),

        outstanding:
          new Prisma.Decimal(
            0,
          ),

        overdue:
          new Prisma.Decimal(
            0,
          ),
      };

    current.invoiced =
      current.invoiced.plus(
        invoice.total,
      );

    current.paid =
      current.paid.plus(
        invoice.paid,
      );

    if (
      invoice.status !==
      InvoiceStatus.CANCELLED
    ) {
      current.outstanding =
        current.outstanding.plus(
          invoice.balance,
        );
    }

    const overdue =
      invoice.status !==
        InvoiceStatus.PAID &&
      invoice.status !==
        InvoiceStatus.CANCELLED &&
      invoice.status !==
        InvoiceStatus.DRAFT &&
      invoice.dueAt !==
        null &&
      invoice.dueAt <
        now &&
      invoice.balance.greaterThan(
        0,
      );

    if (overdue) {
      overdueCount += 1;

      current.overdue =
        current.overdue.plus(
          invoice.balance,
        );
    } else {
      switch (
        invoice.status
      ) {
        case InvoiceStatus.DRAFT:
          draftCount += 1;
          break;

        case InvoiceStatus.SENT:
          sentCount += 1;
          break;

        case InvoiceStatus.PAID:
          paidCount += 1;
          break;

        case InvoiceStatus.PARTIALLY_PAID:
          partiallyPaidCount +=
            1;
          break;

        case InvoiceStatus.OVERDUE:
          overdueCount += 1;
          break;

        case InvoiceStatus.CANCELLED:
          cancelledCount += 1;
          break;
      }
    }

    summaryByCurrency.set(
      invoice.currency,
      current,
    );
  }

  return {
    invoices:
      invoices.map(
        invoiceDTO,
      ),

    pagination: {
      page,
      pageSize,
      total,
      pages,

      hasPrevious:
        page > 1,

      hasNext:
        page < pages,
    },

    summary: {
      totalInvoices:
        allSummary.length,

      counts: {
        draft:
          draftCount,

        sent:
          sentCount,

        paid:
          paidCount,

        partiallyPaid:
          partiallyPaidCount,

        overdue:
          overdueCount,

        cancelled:
          cancelledCount,
      },

      currencies:
        Array.from(
          summaryByCurrency.entries(),
        ).map(
          ([
            currency,
            amounts,
          ]) => ({
            currency,

            invoiced:
              amounts.invoiced.toFixed(
                2,
              ),

            paid:
              amounts.paid.toFixed(
                2,
              ),

            outstanding:
              amounts.outstanding.toFixed(
                2,
              ),

            overdue:
              amounts.overdue.toFixed(
                2,
              ),
          }),
        ),
    },
  };
}

/* =============================================================================
 * CREATE
 * =============================================================================
 */

export async function createInvoice({
  identity: _identity,
  input,
}: {
  identity: InvoiceIdentity;
  input: CreateInvoiceInput;
}) {
  await requireClient(
    input.clientId,
  );

  if (
    input.issuedAt &&
    input.dueAt &&
    input.dueAt <
      input.issuedAt
  ) {
    throw new InvoiceApiError(
      400,
      "Due date cannot be earlier than the issue date.",
    );
  }

  const amounts =
    calculateInvoiceAmounts(
      input.subtotal,
      input.tax,
    );

  /*
   * Reference generation and creation are retried if another request manages
   * to create the same reference between our lookup and insert.
   */

  for (
    let attempt = 0;
    attempt < 3;
    attempt += 1
  ) {
    const invoiceRef =
      await generateInvoiceReference();

    try {
      const invoice =
        await prisma.clientInvoice.create({
          data: {
            clientId:
              input.clientId,

            invoiceRef,

            description:
              input.description ??
              null,

            currency:
              input.currency ??
              DEFAULT_CURRENCY,

            subtotal:
              amounts.subtotal,

            tax:
              amounts.tax,

            total:
              amounts.total,

            paid:
              ZERO_DECIMAL,

            balance:
              amounts.total,

            issuedAt:
              input.issuedAt ??
              null,

            dueAt:
              input.dueAt ??
              null,
          },

          include:
            invoiceInclude,
        });

      await refreshClientBilling(
        input.clientId,
      );

      return invoice;
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code ===
          "P2002" &&
        attempt < 2
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new InvoiceApiError(
    409,
    "Unable to generate a unique invoice reference.",
  );
}

/* =============================================================================
 * UPDATE
 * =============================================================================
 */

export async function updateInvoice({
  identity: _identity,
  invoiceId,
  input,
}: {
  identity: InvoiceIdentity;
  invoiceId: string;
  input: UpdateInvoiceInput;
}) {
  const existing =
    await requireInvoice(
      invoiceId,
    );

  if (
    existing.status ===
    InvoiceStatus.CANCELLED
  ) {
    throw new InvoiceApiError(
      409,
      "A cancelled invoice cannot be edited.",
    );
  }

  if (
    existing.status ===
    InvoiceStatus.PAID
  ) {
    throw new InvoiceApiError(
      409,
      "A paid invoice cannot be edited.",
    );
  }

  const clientId =
    input.clientId ??
    existing.clientId;

  if (
    input.clientId &&
    input.clientId !==
      existing.clientId
  ) {
    await requireClient(
      input.clientId,
    );
  }

  const issuedAt =
    input.issuedAt !==
    undefined
      ? input.issuedAt
      : existing.issuedAt;

  const dueAt =
    input.dueAt !==
    undefined
      ? input.dueAt
      : existing.dueAt;

  if (
    issuedAt &&
    dueAt &&
    dueAt < issuedAt
  ) {
    throw new InvoiceApiError(
      400,
      "Due date cannot be earlier than the issue date.",
    );
  }

  const subtotal =
    input.subtotal !==
    undefined
      ? input.subtotal ??
        ZERO_DECIMAL
      : existing.subtotal;

  const tax =
    input.tax !==
    undefined
      ? input.tax ??
        ZERO_DECIMAL
      : existing.tax;

  const amounts =
    calculateInvoiceAmounts(
      subtotal,
      tax,
      existing.paid,
    );

  if (
    existing.paid.greaterThan(
      amounts.total,
    )
  ) {
    throw new InvoiceApiError(
      400,
      "Invoice total cannot be lower than the amount already paid.",
    );
  }

  let nextStatus =
    existing.status;

  if (
    existing.paid.greaterThan(
      0,
    ) &&
    existing.paid.lessThan(
      amounts.total,
    )
  ) {
    nextStatus =
      InvoiceStatus.PARTIALLY_PAID;
  }

  const invoice =
    await prisma.clientInvoice.update({
      where: {
        id: invoiceId,
      },

      data: {
        ...(input.clientId !==
        undefined
          ? {
              clientId,
            }
          : {}),

        ...(input.description !==
        undefined
          ? {
              description:
                input.description,
            }
          : {}),

        ...(input.currency !==
        undefined
          ? {
              currency:
                input.currency,
            }
          : {}),

        ...(input.subtotal !==
          undefined ||
        input.tax !==
          undefined
          ? {
              subtotal:
                amounts.subtotal,

              tax:
                amounts.tax,

              total:
                amounts.total,

              balance:
                amounts.balance,

              status:
                nextStatus,
            }
          : {}),

        ...(input.issuedAt !==
        undefined
          ? {
              issuedAt:
                input.issuedAt,
            }
          : {}),

        ...(input.dueAt !==
        undefined
          ? {
              dueAt:
                input.dueAt,
            }
          : {}),
      },

      include:
        invoiceInclude,
    });

  await refreshClientBilling(
    existing.clientId,
  );

  if (
    clientId !==
    existing.clientId
  ) {
    await refreshClientBilling(
      clientId,
    );
  }

  return invoice;
}

/* =============================================================================
 * SEND / ISSUE
 * =============================================================================
 */

export async function sendInvoice({
  identity: _identity,
  invoiceId,
}: {
  identity: InvoiceIdentity;
  invoiceId: string;
}) {
  const existing =
    await requireInvoice(
      invoiceId,
    );

  if (
    existing.status ===
    InvoiceStatus.CANCELLED
  ) {
    throw new InvoiceApiError(
      409,
      "A cancelled invoice cannot be sent.",
    );
  }

  if (
    existing.status ===
    InvoiceStatus.PAID
  ) {
    throw new InvoiceApiError(
      409,
      "This invoice has already been paid.",
    );
  }

  if (
    existing.total.lessThanOrEqualTo(
      0,
    )
  ) {
    throw new InvoiceApiError(
      400,
      "Invoice total must be greater than zero before it can be sent.",
    );
  }

  const issuedAt =
    existing.issuedAt ??
    new Date();

  const invoice =
    await prisma.clientInvoice.update({
      where: {
        id: invoiceId,
      },

      data: {
        status:
          existing.paid.greaterThan(
            0,
          )
            ? InvoiceStatus.PARTIALLY_PAID
            : InvoiceStatus.SENT,

        issuedAt,
      },

      include:
        invoiceInclude,
    });

  await refreshClientBilling(
    invoice.clientId,
  );

  return invoice;
}

/* =============================================================================
 * RECORD PAYMENT
 * =============================================================================
 */

export async function recordInvoicePayment({
  identity: _identity,
  invoiceId,
  input,
}: {
  identity: InvoiceIdentity;
  invoiceId: string;
  input: RecordInvoicePaymentInput;
}) {
  if (
    input.amount.lessThanOrEqualTo(
      0,
    )
  ) {
    throw new InvoiceApiError(
      400,
      "Payment amount must be greater than zero.",
    );
  }

  const result =
    await prisma.$transaction(
      async (tx) => {
        const existing =
          await tx.clientInvoice.findUnique({
            where: {
              id: invoiceId,
            },
          });

        if (!existing) {
          throw new InvoiceApiError(
            404,
            "Invoice could not be found.",
          );
        }

        if (
          existing.status ===
          InvoiceStatus.CANCELLED
        ) {
          throw new InvoiceApiError(
            409,
            "Payments cannot be recorded against a cancelled invoice.",
          );
        }

        if (
          existing.status ===
          InvoiceStatus.DRAFT
        ) {
          throw new InvoiceApiError(
            409,
            "Send the invoice before recording a payment.",
          );
        }

        if (
          existing.status ===
          InvoiceStatus.PAID
        ) {
          throw new InvoiceApiError(
            409,
            "This invoice has already been paid.",
          );
        }

        if (
          input.amount.greaterThan(
            existing.balance,
          )
        ) {
          throw new InvoiceApiError(
            400,
            "Payment amount cannot be greater than the outstanding balance.",
          );
        }

        const paid =
          existing.paid.plus(
            input.amount,
          );

        const balance =
          Prisma.Decimal.max(
            existing.total.minus(
              paid,
            ),
            ZERO_DECIMAL,
          );

        const fullyPaid =
          balance.equals(
            ZERO_DECIMAL,
          );

        return tx.clientInvoice.update({
          where: {
            id: invoiceId,
          },

          data: {
            paid,

            balance,

            status:
              fullyPaid
                ? InvoiceStatus.PAID
                : InvoiceStatus.PARTIALLY_PAID,

            paidAt:
              fullyPaid
                ? input.paidAt ??
                  new Date()
                : null,
          },

          include:
            invoiceInclude,
        });
      },
    );

  await refreshClientBilling(
    result.clientId,
  );

  return result;
}

/* =============================================================================
 * MARK PAID
 * =============================================================================
 */

export async function markInvoicePaid({
  identity,
  invoiceId,
  paidAt,
}: {
  identity: InvoiceIdentity;
  invoiceId: string;
  paidAt?: Date | null;
}) {
  const existing =
    await requireInvoice(
      invoiceId,
    );

  if (
    existing.status ===
    InvoiceStatus.CANCELLED
  ) {
    throw new InvoiceApiError(
      409,
      "A cancelled invoice cannot be marked as paid.",
    );
  }

  if (
    existing.status ===
    InvoiceStatus.PAID
  ) {
    return existing;
  }

  if (
    existing.balance.lessThanOrEqualTo(
      0,
    )
  ) {
    const invoice =
      await prisma.clientInvoice.update({
        where: {
          id: invoiceId,
        },

        data: {
          status:
            InvoiceStatus.PAID,

          paid:
            existing.total,

          balance:
            ZERO_DECIMAL,

          paidAt:
            paidAt ??
            new Date(),
        },

        include:
          invoiceInclude,
      });

    await refreshClientBilling(
      invoice.clientId,
    );

    return invoice;
  }

  return recordInvoicePayment({
    identity,
    invoiceId,

    input: {
      amount:
        existing.balance,

      paidAt:
        paidAt ??
        new Date(),
    },
  });
}

/* =============================================================================
 * CANCEL
 * =============================================================================
 */

export async function cancelInvoice({
  identity: _identity,
  invoiceId,
}: {
  identity: InvoiceIdentity;
  invoiceId: string;
}) {
  const existing =
    await requireInvoice(
      invoiceId,
    );

  if (
    existing.status ===
    InvoiceStatus.PAID
  ) {
    throw new InvoiceApiError(
      409,
      "A paid invoice cannot be cancelled.",
    );
  }

  if (
    existing.paid.greaterThan(
      0,
    )
  ) {
    throw new InvoiceApiError(
      409,
      "An invoice with recorded payments cannot be cancelled until those payments are reconciled.",
    );
  }

  if (
    existing.status ===
    InvoiceStatus.CANCELLED
  ) {
    return existing;
  }

  const invoice =
    await prisma.clientInvoice.update({
      where: {
        id: invoiceId,
      },

      data: {
        status:
          InvoiceStatus.CANCELLED,
      },

      include:
        invoiceInclude,
    });

  await refreshClientBilling(
    invoice.clientId,
  );

  return invoice;
}

/* =============================================================================
 * DELETE DRAFT
 * =============================================================================
 */

export async function deleteInvoice({
  identity: _identity,
  invoiceId,
}: {
  identity: InvoiceIdentity;
  invoiceId: string;
}) {
  const existing =
    await requireInvoice(
      invoiceId,
    );

  if (
    existing.status !==
    InvoiceStatus.DRAFT
  ) {
    throw new InvoiceApiError(
      409,
      "Only draft invoices can be deleted. Cancel an issued invoice instead.",
    );
  }

  if (
    existing.matchedMonzoTransactions.length >
    0
  ) {
    throw new InvoiceApiError(
      409,
      "This invoice has matched bank transactions and cannot be deleted.",
    );
  }

  if (
    existing.timesheetEntries.length >
    0
  ) {
    throw new InvoiceApiError(
      409,
      "This invoice contains billed timesheet entries and cannot be deleted.",
    );
  }

  await prisma.clientInvoice.delete({
    where: {
      id: invoiceId,
    },
  });

  await refreshClientBilling(
    existing.clientId,
  );

  return {
    id:
      existing.id,

    invoiceRef:
      existing.invoiceRef,
  };
}

/* =============================================================================
 * CLIENT BILLING CACHE
 * =============================================================================
 */

export async function refreshClientBilling(
  clientId: string,
) {
  const invoices =
    await prisma.clientInvoice.findMany({
      where: {
        clientId,
      },

      select: {
        invoiceRef:
          true,

        status:
          true,

        total:
          true,

        paid:
          true,

        balance:
          true,

        issuedAt:
          true,

        createdAt:
          true,
      },

      orderBy: [
        {
          issuedAt:
            "desc",
        },

        {
          createdAt:
            "desc",
        },
      ],
    });

  let outstandingAmount =
    new Prisma.Decimal(
      0,
    );

  let totalPaid =
    new Prisma.Decimal(
      0,
    );

  for (
    const invoice of
    invoices
  ) {
    totalPaid =
      totalPaid.plus(
        invoice.paid,
      );

    if (
      invoice.status !==
      InvoiceStatus.CANCELLED
    ) {
      outstandingAmount =
        outstandingAmount.plus(
          invoice.balance,
        );
    }
  }

  const lastInvoice =
    invoices[0] ??
    null;

  return prisma.clientBilling.upsert({
    where: {
      clientId,
    },

    create: {
      clientId,

      lastInvoiceRef:
        lastInvoice?.invoiceRef ??
        null,

      lastInvoiceAt:
        lastInvoice?.issuedAt ??
        lastInvoice?.createdAt ??
        null,

      lastInvoiceStatus:
        lastInvoice?.status ??
        null,

      outstandingAmount,

      totalPaid,
    },

    update: {
      lastInvoiceRef:
        lastInvoice?.invoiceRef ??
        null,

      lastInvoiceAt:
        lastInvoice?.issuedAt ??
        lastInvoice?.createdAt ??
        null,

      lastInvoiceStatus:
        lastInvoice?.status ??
        null,

      outstandingAmount,

      totalPaid,
    },
  });
}

/* =============================================================================
 * OVERDUE SYNCHRONISATION
 * =============================================================================
 */

export async function syncOverdueInvoices() {
  const now =
    new Date();

  return prisma.clientInvoice.updateMany({
    where: {
      status: {
        in: [
          InvoiceStatus.SENT,
          InvoiceStatus.PARTIALLY_PAID,
        ],
      },

      dueAt: {
        lt: now,
      },

      balance: {
        gt:
          ZERO_DECIMAL,
      },
    },

    data: {
      status:
        InvoiceStatus.OVERDUE,
    },
  });
}