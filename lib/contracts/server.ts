import "server-only";

import {
  ContractType,
  ContractStatus,
  ContractActivityType,
  BillingCycle,
  CurrencyCode,
  Prisma,
  type AdminRole,
} from "@/app/generated/prisma/client";

import {
  AuthenticationError,
  AuthorisationError,
  requireAdmin,
} from "@/lib/auth/current-admin";

import { prisma } from "@/lib/prisma";

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * EXPIRING is never persisted (see Prisma ContractStatus). A contract is
 * "expiring" at read time when it is ACTIVE and its endDate falls within
 * this window. Past that window with no endDate change, it reads as EXPIRED
 * even if the stored status has not been moved off ACTIVE yet.
 */
const EXPIRING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const CONTRACT_MANAGER_ROLES: AdminRole[] = [
  "OWNER",
  "ADMIN",
  "DEVELOPER",
  "FINANCE",
];

/* =============================================================================
 * TYPES
 * =============================================================================
 */

export type ContractIdentity = {
  id: string;
  email: string;
  role: AdminRole;
};

export type ContractStatusFilter = ContractStatus | "EXPIRING";

export type ContractSort =
  | "updated_desc"
  | "created_desc"
  | "end_asc"
  | "end_desc"
  | "value_desc"
  | "value_asc"
  | "title_asc"
  | "title_desc";

export type ContractFeedFilters = {
  search?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  type?: ContractType | null;
  status?: ContractStatusFilter | null;
  currency?: CurrencyCode | null;
  page?: number;
  pageSize?: number;
  sort?: ContractSort | null;
};

export type CreateContractInput = {
  clientId: string;
  projectId?: string | null;

  title: string;
  description?: string | null;

  type: ContractType;

  value?: Prisma.Decimal | null;
  currency?: CurrencyCode;
  billingCycle?: string | null;

  startDate?: Date | null;
  endDate?: Date | null;
  renewalAt?: Date | null;

  autoRenew?: boolean;
  noticePeriodDays?: number | null;

  signedAt?: Date | null;
  signedByClientName?: string | null;
  signedByCompanyName?: string | null;

  documentName?: string | null;
  documentUrl?: string | null;
  documentMimeType?: string | null;
  documentSizeBytes?: bigint | null;

  notes?: string | null;
};

export type UpdateContractInput = {
  title?: string;
  description?: string | null;

  type?: ContractType;
  projectId?: string | null;

  value?: Prisma.Decimal | null;
  currency?: CurrencyCode;
  billingCycle?: string | null;

  startDate?: Date | null;
  endDate?: Date | null;
  renewalAt?: Date | null;

  autoRenew?: boolean;
  noticePeriodDays?: number | null;

  signedAt?: Date | null;
  signedByClientName?: string | null;
  signedByCompanyName?: string | null;

  documentName?: string | null;
  documentUrl?: string | null;
  documentMimeType?: string | null;
  documentSizeBytes?: bigint | null;

  notes?: string | null;
};

/* =============================================================================
 * PRISMA PAYLOAD SHAPES
 * =============================================================================
 */

const contractClientSelect = {
  id: true,
  name: true,
  displayName: true,
  clientRef: true,
  status: true,
  currency: true,
} satisfies Prisma.ClientSelect;

const contractProjectSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  clientId: true,
} satisfies Prisma.ProjectSelect;

const adminSummarySelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.AdminUserSelect;

/**
 * Lean projection used by the paginated feed. Activities are intentionally
 * excluded here: loading the full activity trail for every row on every page
 * would be wasteful, and ContractsTab's list view never renders it.
 */
const contractListInclude = {
  client: { select: contractClientSelect },
  project: { select: contractProjectSelect },
} satisfies Prisma.ContractInclude;

/**
 * Full projection used wherever a single contract is returned (create,
 * update, lifecycle actions, and GET by id).
 */
const contractDetailInclude = {
  client: { select: contractClientSelect },
  project: { select: contractProjectSelect },
  createdBy: { select: adminSummarySelect },
  updatedBy: { select: adminSummarySelect },
  activities: {
    select: {
      id: true,
      type: true,
      description: true,
      metadata: true,
      createdAt: true,
      actor: { select: adminSummarySelect },
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.ContractInclude;

type ContractListRecord = Prisma.ContractGetPayload<{
  include: typeof contractListInclude;
}>;

type ContractRecord = Prisma.ContractGetPayload<{
  include: typeof contractDetailInclude;
}>;

/* =============================================================================
 * ERROR CLASS
 * =============================================================================
 */

export class ContractApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ContractApiError";
    this.status = status;
  }
}

/* =============================================================================
 * ERROR HANDLING
 * =============================================================================
 */

export function contractApiError(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof ContractApiError) {
    return { status: error.status, message: error.message };
  }

  if (error instanceof AuthenticationError) {
    return {
      status: 401,
      message: error.message || "Authentication required.",
    };
  }

  if (error instanceof AuthorisationError) {
    return {
      status: 403,
      message:
        error.message ||
        "You do not have permission to perform this action.",
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return {
        status: 404,
        message: "The requested contract could not be found.",
      };
    }

    if (error.code === "P2002") {
      return {
        status: 409,
        message: "A contract with the same reference already exists.",
      };
    }

    if (error.code === "P2003") {
      return {
        status: 400,
        message: "The contract references a record that does not exist.",
      };
    }
  }

  console.error("[Contracts API Error]", error);

  return {
    status: 400,
    message:
      error instanceof Error
        ? error.message
        : "Something went wrong while processing the contract.",
  };
}

/* =============================================================================
 * IDENTITY / PERMISSIONS
 * =============================================================================
 */

export async function requireContractIdentity(): Promise<ContractIdentity> {
  const admin = await requireAdmin();

  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
  };
}

function canManageContracts(identity: ContractIdentity): boolean {
  return CONTRACT_MANAGER_ROLES.includes(identity.role);
}

function assertCanManageContracts(identity: ContractIdentity) {
  if (!canManageContracts(identity)) {
    throw new AuthorisationError(
      "Only the owner, administrators, developers and finance users can manage contracts.",
    );
  }
}

/* =============================================================================
 * BASIC VALIDATION
 * =============================================================================
 */

export function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new ContractApiError(400, `${label} is required.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new ContractApiError(400, `${label} is required.`);
  }

  return trimmed;
}

export function optionalText(
  value: unknown,
  label: string,
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ContractApiError(400, `${label} must be text.`);
  }

  const trimmed = value.trim();

  return trimmed || null;
}

export function optionalBoolean(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "boolean") {
    throw new ContractApiError(400, "Expected a true or false value.");
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
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new ContractApiError(400, `${label} must be a valid amount.`);
  }

  const raw = typeof value === "string" ? value.trim() : String(value);

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new ContractApiError(
      400,
      `${label} must be a non-negative amount with no more than two decimal places.`,
    );
  }

  try {
    const amount = new Prisma.Decimal(raw);

    if (amount.lessThan(0)) {
      throw new Error();
    }

    return amount;
  } catch {
    throw new ContractApiError(
      400,
      `${label} must be a valid non-negative amount.`,
    );
  }
}

/* =============================================================================
 * DATE VALIDATION
 * =============================================================================
 */

export function optionalDateTime(
  value: unknown,
  label: string,
): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new ContractApiError(400, `${label} must be a valid date.`);
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ContractApiError(400, `${label} must be a valid date.`);
  }

  return parsed;
}

/* =============================================================================
 * INTEGER VALIDATION
 * =============================================================================
 */

export function optionalNonNegativeInteger(
  value: unknown,
  label: string,
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new ContractApiError(
        400,
        `${label} must be a non-negative whole number.`,
      );
    }

    return value;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    throw new ContractApiError(
      400,
      `${label} must be a non-negative whole number.`,
    );
  }

  return Number.parseInt(value.trim(), 10);
}

/* =============================================================================
 * ENUM PARSERS
 * =============================================================================
 */

export function parseContractType(value: unknown): ContractType {
  if (typeof value !== "string" || !value.trim()) {
    throw new ContractApiError(400, "Contract type is required.");
  }

  const normalized = value.trim().toUpperCase();

  if (!Object.values(ContractType).includes(normalized as ContractType)) {
    throw new ContractApiError(400, "Contract type is invalid.");
  }

  return normalized as ContractType;
}

export function parseContractStatus(
  value: unknown,
): ContractStatusFilter | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ContractApiError(400, "Contract status is invalid.");
  }

  const normalized = value.trim().toUpperCase();

  if (normalized === "EXPIRING") {
    return "EXPIRING";
  }

  if (!Object.values(ContractStatus).includes(normalized as ContractStatus)) {
    throw new ContractApiError(400, "Contract status is invalid.");
  }

  return normalized as ContractStatus;
}

export function parseCurrencyCode(value: unknown): CurrencyCode {
  if (typeof value !== "string") {
    throw new ContractApiError(400, "Currency is invalid.");
  }

  const normalized = value.trim().toUpperCase();

  if (!Object.values(CurrencyCode).includes(normalized as CurrencyCode)) {
    throw new ContractApiError(400, "Currency is invalid.");
  }

  return normalized as CurrencyCode;
}

function parseBillingCycleValue(
  value: string | null | undefined,
): BillingCycle | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  if (!Object.values(BillingCycle).includes(normalized as BillingCycle)) {
    throw new ContractApiError(400, "Billing cycle is invalid.");
  }

  return normalized as BillingCycle;
}

export function parseContractSort(value: unknown): ContractSort {
  if (value === undefined || value === null || value === "") {
    return "updated_desc";
  }

  const allowed: ContractSort[] = [
    "updated_desc",
    "created_desc",
    "end_asc",
    "end_desc",
    "value_desc",
    "value_asc",
    "title_asc",
    "title_desc",
  ];

  if (typeof value !== "string" || !allowed.includes(value as ContractSort)) {
    throw new ContractApiError(400, "Contract sort is invalid.");
  }

  return value as ContractSort;
}

/* =============================================================================
 * SERIALISATION
 * =============================================================================
 */

function decimalString(value: Prisma.Decimal | null | undefined) {
  return value ? value.toFixed(2) : null;
}

function bigintString(value: bigint | null | undefined) {
  return value === null || value === undefined ? null : value.toString();
}

function dateString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function daysUntil(value: Date | null | undefined): number | null {
  if (!value) return null;

  return Math.ceil((value.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function adminSummary(
  admin:
    | {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      }
    | null,
) {
  if (!admin) return null;

  const name = [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim();

  return {
    id: admin.id,
    name: name || admin.email,
    email: admin.email,
  };
}

/* =============================================================================
 * DERIVED STATUS
 *
 * EXPIRING is never stored (see Prisma ContractStatus). EXPIRED can be
 * stored, but this also derives it live from endDate so a contract reads as
 * expired the moment its term lapses, without depending on a sync job.
 * =============================================================================
 */

export function getEffectiveContractStatus(contract: {
  status: ContractStatus;
  endDate: Date | null;
}): ContractStatus | "EXPIRING" {
  if (contract.status !== ContractStatus.ACTIVE) {
    return contract.status;
  }

  if (!contract.endDate) {
    return ContractStatus.ACTIVE;
  }

  const msUntilEnd = contract.endDate.getTime() - Date.now();

  if (msUntilEnd < 0) {
    return ContractStatus.EXPIRED;
  }

  if (msUntilEnd <= EXPIRING_WINDOW_MS) {
    return "EXPIRING";
  }

  return ContractStatus.ACTIVE;
}

/* =============================================================================
 * PERMISSIONS (per contract)
 * =============================================================================
 */

function computeContractPermissions(
  contract: { status: ContractStatus; signedAt: Date | null },
  identity: ContractIdentity,
) {
  const manage = canManageContracts(identity);
  const locked =
    contract.status === ContractStatus.TERMINATED ||
    contract.status === ContractStatus.CANCELLED;

  return {
    canEdit: manage && !locked,
    canSendForSignature: manage && contract.status === ContractStatus.DRAFT,
    canMarkSigned:
      manage && contract.status === ContractStatus.PENDING_SIGNATURE,
    canActivate:
      manage &&
      contract.status === ContractStatus.PENDING_SIGNATURE &&
      contract.signedAt !== null,
    canRenew:
      manage &&
      (contract.status === ContractStatus.ACTIVE ||
        contract.status === ContractStatus.EXPIRED),
    canTerminate: manage && contract.status === ContractStatus.ACTIVE,
    canCancel:
      manage &&
      (contract.status === ContractStatus.DRAFT ||
        contract.status === ContractStatus.PENDING_SIGNATURE),
    canReplaceDocument: manage && !locked,
    canDelete: manage && contract.status === ContractStatus.DRAFT,
  };
}

/* =============================================================================
 * DTO
 * =============================================================================
 */

function baseContractFields(contract: ContractListRecord) {
  return {
    id: contract.id,
    contractRef: contract.contractRef,

    clientId: contract.clientId,
    projectId: contract.projectId,

    title: contract.title,
    type: contract.type,

    status: contract.status,
    displayStatus: getEffectiveContractStatus(contract),

    value: decimalString(contract.value),
    currency: contract.currency,
    billingCycle: contract.billingCycle,

    startDate: dateString(contract.startDate),
    endDate: dateString(contract.endDate),
    renewalAt: dateString(contract.renewalAt),
    autoRenew: contract.autoRenew,

    signedAt: dateString(contract.signedAt),
    documentUrl: contract.documentUrl,

    client: {
      id: contract.client.id,
      name: contract.client.name,
      displayName: contract.client.displayName,
      clientRef: contract.client.clientRef,
      status: contract.client.status,
      currency: contract.client.currency,
    },

    project: contract.project
      ? {
          id: contract.project.id,
          name: contract.project.name,
          slug: contract.project.slug,
          status: contract.project.status,
          clientId: contract.project.clientId,
        }
      : null,

    daysUntilExpiry: daysUntil(contract.endDate),
    daysUntilRenewal: daysUntil(contract.renewalAt),

    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  };
}

function contractListDTO(contract: ContractListRecord) {
  return baseContractFields(contract);
}

export function contractDTO(
  contract: ContractRecord,
  identity: ContractIdentity,
) {
  return {
    ...baseContractFields(contract),

    description: contract.description,
    noticePeriodDays: contract.noticePeriodDays,

    signedByClientName: contract.signedByClientName,
    signedByCompanyName: contract.signedByCompanyName,

    documentName: contract.documentName,
    documentMimeType: contract.documentMimeType,
    documentSizeBytes: bigintString(contract.documentSizeBytes),

    notes: contract.notes,

    createdBy: adminSummary(contract.createdBy),
    updatedBy: adminSummary(contract.updatedBy),

    activities: contract.activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      description: activity.description,
      metadata: activity.metadata,
      actor: adminSummary(activity.actor),
      createdAt: activity.createdAt.toISOString(),
    })),

    permissions: computeContractPermissions(contract, identity),
  };
}

/* =============================================================================
 * REQUIRE CLIENT / PROJECT
 * =============================================================================
 */

async function requireClientForContract(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });

  if (!client) {
    throw new ContractApiError(404, "Client could not be found.");
  }

  return client;
}

async function requireProjectForClient(projectId: string, clientId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, clientId: true },
  });

  if (!project) {
    throw new ContractApiError(404, "Project could not be found.");
  }

  if (project.clientId !== clientId) {
    throw new ContractApiError(
      400,
      "The selected project does not belong to this client.",
    );
  }

  return project;
}

/* =============================================================================
 * REQUIRE CONTRACT
 * =============================================================================
 */

export async function requireContract(
  contractId: string,
): Promise<ContractRecord> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: contractDetailInclude,
  });

  if (!contract) {
    throw new ContractApiError(404, "Contract could not be found.");
  }

  return contract;
}

/* =============================================================================
 * DATE COHERENCE
 * =============================================================================
 */

function assertDateOrder(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
) {
  if (startDate && endDate && endDate < startDate) {
    throw new ContractApiError(
      400,
      "End date cannot be earlier than the start date.",
    );
  }
}

function assertRenewalOrder(
  endDate: Date | null | undefined,
  renewalAt: Date | null | undefined,
) {
  if (endDate && renewalAt && renewalAt > endDate) {
    throw new ContractApiError(
      400,
      "Renewal date cannot be after the end date.",
    );
  }
}

/* =============================================================================
 * ACTIVITY LOG
 * =============================================================================
 */

async function logContractActivity(params: {
  contractId: string;
  actorId: string | null;
  type: ContractActivityType;
  description?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.contractActivity.create({
    data: {
      contractId: params.contractId,
      actorId: params.actorId,
      type: params.type,
      description: params.description ?? null,
      metadata: params.metadata,
    },
  });
}

/* =============================================================================
 * REFERENCE GENERATION
 * =============================================================================
 */

async function generateContractReference() {
  const year = new Date().getUTCFullYear();
  const prefix = `CTR-${year}-`;

  /*
   * We look up the latest contract reference for the current year rather
   * than using count(), because deleting a draft contract would otherwise
   * allow an existing reference to be generated again.
   */

  const latest = await prisma.contract.findFirst({
    where: { contractRef: { startsWith: prefix } },
    orderBy: { contractRef: "desc" },
    select: { contractRef: true },
  });

  let next = 1;

  if (latest) {
    const suffix = latest.contractRef.slice(prefix.length);
    const parsed = Number.parseInt(suffix, 10);

    if (Number.isInteger(parsed)) {
      next = parsed + 1;
    }
  }

  return prefix + String(next).padStart(4, "0");
}

/* =============================================================================
 * WHERE BUILDER
 * =============================================================================
 */

function buildContractWhere(
  filters: ContractFeedFilters,
): Prisma.ContractWhereInput {
  const AND: Prisma.ContractWhereInput[] = [];

  const search = filters.search?.trim();

  if (search) {
    AND.push({
      OR: [
        { contractRef: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        {
          client: {
            is: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { displayName: { contains: search, mode: "insensitive" } },
                { clientRef: { contains: search, mode: "insensitive" } },
                { contactName: { contains: search, mode: "insensitive" } },
                { contactEmail: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          project: {
            is: { name: { contains: search, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  if (filters.clientId) {
    AND.push({ clientId: filters.clientId });
  }

  if (filters.projectId) {
    AND.push({ projectId: filters.projectId });
  }

  if (filters.type) {
    AND.push({ type: filters.type });
  }

  if (filters.currency) {
    AND.push({ currency: filters.currency });
  }

  /*
   * EXPIRING and EXPIRED are partly or fully derived (see
   * getEffectiveContractStatus), so filtering on them has to reconstruct the
   * same date math rather than compare against the stored status alone.
   */

  const now = new Date();
  const expiringBefore = new Date(now.getTime() + EXPIRING_WINDOW_MS);

  if (filters.status === "EXPIRING") {
    AND.push({
      status: ContractStatus.ACTIVE,
      endDate: { gt: now, lte: expiringBefore },
    });
  } else if (filters.status === ContractStatus.EXPIRED) {
    AND.push({
      OR: [
        { status: ContractStatus.EXPIRED },
        { status: ContractStatus.ACTIVE, endDate: { lte: now } },
      ],
    });
  } else if (filters.status === ContractStatus.ACTIVE) {
    AND.push({
      status: ContractStatus.ACTIVE,
      OR: [{ endDate: null }, { endDate: { gt: expiringBefore } }],
    });
  } else if (filters.status) {
    AND.push({ status: filters.status });
  }

  if (AND.length === 0) {
    return {};
  }

  return { AND };
}

/* =============================================================================
 * ORDER BUILDER
 * =============================================================================
 */

function buildContractOrderBy(
  sort: ContractSort | null | undefined,
): Prisma.ContractOrderByWithRelationInput {
  switch (sort) {
    case "created_desc":
      return { createdAt: "desc" };
    case "end_asc":
      return { endDate: "asc" };
    case "end_desc":
      return { endDate: "desc" };
    case "value_desc":
      return { value: "desc" };
    case "value_asc":
      return { value: "asc" };
    case "title_asc":
      return { title: "asc" };
    case "title_desc":
      return { title: "desc" };
    case "updated_desc":
    default:
      return { updatedAt: "desc" };
  }
}

/* =============================================================================
 * FEED
 * =============================================================================
 */

export async function getContractFeed({
  filters = {},
}: {
  filters?: ContractFeedFilters;
} = {}) {
  const page = Math.max(DEFAULT_PAGE, filters.page ?? DEFAULT_PAGE);

  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE),
  );

  const where = buildContractWhere(filters);
  const orderBy = buildContractOrderBy(filters.sort);

  const [total, contracts, allSummary] = await Promise.all([
    prisma.contract.count({ where }),

    prisma.contract.findMany({
      where,
      include: contractListInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),

    /*
     * Summary tiles reflect every contract regardless of the active list
     * filters, so this intentionally has no `where` clause.
     */
    prisma.contract.findMany({
      select: {
        status: true,
        value: true,
        currency: true,
        endDate: true,
      },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  let draftCount = 0;
  let pendingSignatureCount = 0;
  let activeCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  let terminatedCount = 0;
  let cancelledCount = 0;

  const currencyTotals = new Map<
    CurrencyCode,
    { value: Prisma.Decimal; count: number }
  >();

  const activeByCurrency = new Map<CurrencyCode, Prisma.Decimal>();
  const expiringByCurrency = new Map<CurrencyCode, Prisma.Decimal>();

  for (const contract of allSummary) {
    const displayStatus = getEffectiveContractStatus(contract);
    const value = contract.value ?? new Prisma.Decimal(0);

    switch (displayStatus) {
      case ContractStatus.DRAFT:
        draftCount += 1;
        break;

      case ContractStatus.PENDING_SIGNATURE:
        pendingSignatureCount += 1;
        break;

      case ContractStatus.ACTIVE: {
        activeCount += 1;

        activeByCurrency.set(
          contract.currency,
          (activeByCurrency.get(contract.currency) ?? new Prisma.Decimal(0)).plus(value),
        );

        const current = currencyTotals.get(contract.currency) ?? {
          value: new Prisma.Decimal(0),
          count: 0,
        };

        currencyTotals.set(contract.currency, {
          value: current.value.plus(value),
          count: current.count + 1,
        });

        break;
      }

      case "EXPIRING": {
        expiringCount += 1;

        expiringByCurrency.set(
          contract.currency,
          (expiringByCurrency.get(contract.currency) ?? new Prisma.Decimal(0)).plus(value),
        );

        const current = currencyTotals.get(contract.currency) ?? {
          value: new Prisma.Decimal(0),
          count: 0,
        };

        currencyTotals.set(contract.currency, {
          value: current.value.plus(value),
          count: current.count + 1,
        });

        break;
      }

      case ContractStatus.EXPIRED:
        expiredCount += 1;
        break;

      case ContractStatus.TERMINATED:
        terminatedCount += 1;
        break;

      case ContractStatus.CANCELLED:
        cancelledCount += 1;
        break;
    }
  }

  const currencyBreakdown = Array.from(currencyTotals.entries())
    .map(([currency, totals]) => ({
      currency,
      value: totals.value.toNumber(),
      count: totals.count,
    }))
    .sort((a, b) => b.value - a.value);

  const mainCurrency = currencyBreakdown[0]?.currency ?? null;

  const totalActiveValue = mainCurrency
    ? (activeByCurrency.get(mainCurrency)?.toNumber() ?? 0)
    : 0;

  const expiringValue = mainCurrency
    ? (expiringByCurrency.get(mainCurrency)?.toNumber() ?? 0)
    : 0;

  return {
    contracts: contracts.map(contractListDTO),

    summary: {
      total: allSummary.length,
      draft: draftCount,
      pendingSignature: pendingSignatureCount,
      active: activeCount,
      expiring: expiringCount,
      expired: expiredCount,
      terminated: terminatedCount,
      cancelled: cancelledCount,
      totalActiveValue,
      expiringValue,
      currencyBreakdown,
    },

    pagination: {
      page,
      pageSize,
      total,
      pageCount,
      hasPreviousPage: page > 1,
      hasNextPage: page < pageCount,
    },
  };
}

/* =============================================================================
 * CREATE
 * =============================================================================
 */

export async function createContract({
  identity,
  input,
}: {
  identity: ContractIdentity;
  input: CreateContractInput;
}) {
  assertCanManageContracts(identity);

  await requireClientForContract(input.clientId);

  if (input.projectId) {
    await requireProjectForClient(input.projectId, input.clientId);
  }

  assertDateOrder(input.startDate, input.endDate);
  assertRenewalOrder(input.endDate, input.renewalAt);

  const billingCycle = parseBillingCycleValue(input.billingCycle);

  /*
   * Reference generation and creation are retried if another request
   * manages to create the same reference between our lookup and insert.
   */

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const contractRef = await generateContractReference();

    try {
      const contract = await prisma.contract.create({
        data: {
          contractRef,
          clientId: input.clientId,
          projectId: input.projectId ?? null,

          title: input.title,
          description: input.description ?? null,

          type: input.type,

          value: input.value ?? null,
          ...(input.currency ? { currency: input.currency } : {}),
          billingCycle,

          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          renewalAt: input.renewalAt ?? null,

          autoRenew: input.autoRenew ?? false,
          noticePeriodDays: input.noticePeriodDays ?? null,

          signedAt: input.signedAt ?? null,
          signedByClientName: input.signedByClientName ?? null,
          signedByCompanyName: input.signedByCompanyName ?? null,

          documentName: input.documentName ?? null,
          documentUrl: input.documentUrl ?? null,
          documentMimeType: input.documentMimeType ?? null,
          documentSizeBytes: input.documentSizeBytes ?? null,

          notes: input.notes ?? null,

          createdById: identity.id,
          updatedById: identity.id,
        },
        include: contractDetailInclude,
      });

      await logContractActivity({
        contractId: contract.id,
        actorId: identity.id,
        type: ContractActivityType.CONTRACT_CREATED,
        description: "Contract created.",
      });

      return contract;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < 2
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new ContractApiError(
    409,
    "Unable to generate a unique contract reference.",
  );
}

/* =============================================================================
 * UPDATE
 * =============================================================================
 */

export async function updateContract({
  identity,
  contractId,
  input,
}: {
  identity: ContractIdentity;
  contractId: string;
  input: UpdateContractInput;
}) {
  assertCanManageContracts(identity);

  const existing = await requireContract(contractId);

  if (
    existing.status === ContractStatus.TERMINATED ||
    existing.status === ContractStatus.CANCELLED
  ) {
    throw new ContractApiError(
      409,
      "A terminated or cancelled contract cannot be edited.",
    );
  }

  if (input.projectId !== undefined && input.projectId !== null) {
    await requireProjectForClient(input.projectId, existing.clientId);
  }

  const startDate =
    input.startDate !== undefined ? input.startDate : existing.startDate;
  const endDate =
    input.endDate !== undefined ? input.endDate : existing.endDate;
  const renewalAt =
    input.renewalAt !== undefined ? input.renewalAt : existing.renewalAt;

  assertDateOrder(startDate, endDate);
  assertRenewalOrder(endDate, renewalAt);

  const billingCycle =
    input.billingCycle !== undefined
      ? parseBillingCycleValue(input.billingCycle)
      : undefined;

  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.projectId !== undefined
        ? { projectId: input.projectId }
        : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(billingCycle !== undefined ? { billingCycle } : {}),
      ...(input.startDate !== undefined
        ? { startDate: input.startDate }
        : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      ...(input.renewalAt !== undefined
        ? { renewalAt: input.renewalAt }
        : {}),
      ...(input.autoRenew !== undefined
        ? { autoRenew: input.autoRenew }
        : {}),
      ...(input.noticePeriodDays !== undefined
        ? { noticePeriodDays: input.noticePeriodDays }
        : {}),
      ...(input.signedAt !== undefined ? { signedAt: input.signedAt } : {}),
      ...(input.signedByClientName !== undefined
        ? { signedByClientName: input.signedByClientName }
        : {}),
      ...(input.signedByCompanyName !== undefined
        ? { signedByCompanyName: input.signedByCompanyName }
        : {}),
      ...(input.documentName !== undefined
        ? { documentName: input.documentName }
        : {}),
      ...(input.documentUrl !== undefined
        ? { documentUrl: input.documentUrl }
        : {}),
      ...(input.documentMimeType !== undefined
        ? { documentMimeType: input.documentMimeType }
        : {}),
      ...(input.documentSizeBytes !== undefined
        ? { documentSizeBytes: input.documentSizeBytes }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),

      updatedById: identity.id,
    },
    include: contractDetailInclude,
  });

  await logContractActivity({
    contractId: contract.id,
    actorId: identity.id,
    type: ContractActivityType.CONTRACT_UPDATED,
    description: "Contract details updated.",
  });

  return contract;
}

/* =============================================================================
 * DELETE
 * =============================================================================
 */

export async function deleteContract({
  identity,
  contractId,
}: {
  identity: ContractIdentity;
  contractId: string;
}) {
  assertCanManageContracts(identity);

  const existing = await requireContract(contractId);

  if (existing.status !== ContractStatus.DRAFT) {
    throw new ContractApiError(
      409,
      "Only draft contracts can be deleted. Cancel or terminate it instead.",
    );
  }

  await prisma.contract.delete({ where: { id: contractId } });

  return { id: existing.id, contractRef: existing.contractRef };
}

/* =============================================================================
 * SEND FOR SIGNATURE
 * =============================================================================
 */

export async function sendContractForSignature({
  identity,
  contractId,
}: {
  identity: ContractIdentity;
  contractId: string;
}) {
  assertCanManageContracts(identity);

  const existing = await requireContract(contractId);

  if (existing.status !== ContractStatus.DRAFT) {
    throw new ContractApiError(
      409,
      "Only draft contracts can be sent for signature.",
    );
  }

  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: ContractStatus.PENDING_SIGNATURE,
      updatedById: identity.id,
    },
    include: contractDetailInclude,
  });

  await logContractActivity({
    contractId: contract.id,
    actorId: identity.id,
    type: ContractActivityType.SENT_FOR_SIGNATURE,
    description: "Sent to the client for signature.",
  });

  return contract;
}

/* =============================================================================
 * MARK SIGNED
 * =============================================================================
 */

export async function markContractSigned({
  identity,
  contractId,
  signedAt,
  signedByClientName,
  signedByCompanyName,
}: {
  identity: ContractIdentity;
  contractId: string;
  signedAt?: Date;
  signedByClientName: string | null;
  signedByCompanyName: string | null;
}) {
  assertCanManageContracts(identity);

  const existing = await requireContract(contractId);

  if (existing.status !== ContractStatus.PENDING_SIGNATURE) {
    throw new ContractApiError(
      409,
      "The contract must be sent for signature before it can be marked as signed.",
    );
  }

  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      signedAt: signedAt ?? new Date(),
      signedByClientName,
      signedByCompanyName,
      updatedById: identity.id,
    },
    include: contractDetailInclude,
  });

  await logContractActivity({
    contractId: contract.id,
    actorId: identity.id,
    type: ContractActivityType.SIGNED,
    description: "Marked as signed.",
  });

  return contract;
}

/* =============================================================================
 * ACTIVATE
 * =============================================================================
 */

export async function activateContract({
  identity,
  contractId,
}: {
  identity: ContractIdentity;
  contractId: string;
}) {
  assertCanManageContracts(identity);

  const existing = await requireContract(contractId);

  if (existing.status !== ContractStatus.PENDING_SIGNATURE) {
    throw new ContractApiError(
      409,
      "Only contracts pending signature can be activated.",
    );
  }

  if (!existing.signedAt) {
    throw new ContractApiError(
      409,
      "The contract must be signed before it can be activated.",
    );
  }

  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: ContractStatus.ACTIVE,
      startDate: existing.startDate ?? new Date(),
      updatedById: identity.id,
    },
    include: contractDetailInclude,
  });

  await logContractActivity({
    contractId: contract.id,
    actorId: identity.id,
    type: ContractActivityType.ACTIVATED,
    description: "Contract activated.",
  });

  return contract;
}

/* =============================================================================
 * RENEW
 * =============================================================================
 */

export async function renewContract({
  identity,
  contractId,
  startDate,
  endDate,
  renewalAt,
  value,
  billingCycle,
  autoRenew,
  noticePeriodDays,
}: {
  identity: ContractIdentity;
  contractId: string;
  startDate: Date;
  endDate: Date;
  renewalAt: Date | null;
  value?: Prisma.Decimal | null;
  billingCycle?: string | null;
  autoRenew?: boolean;
  noticePeriodDays?: number | null;
}) {
  assertCanManageContracts(identity);

  const existing = await requireContract(contractId);

  if (
    existing.status !== ContractStatus.ACTIVE &&
    existing.status !== ContractStatus.EXPIRED
  ) {
    throw new ContractApiError(
      409,
      "Only active or expired contracts can be renewed.",
    );
  }

  if (endDate < startDate) {
    throw new ContractApiError(
      400,
      "End date cannot be earlier than the start date.",
    );
  }

  assertRenewalOrder(endDate, renewalAt);

  const parsedBillingCycle =
    billingCycle !== undefined
      ? parseBillingCycleValue(billingCycle)
      : undefined;

  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: ContractStatus.ACTIVE,
      startDate,
      endDate,
      renewalAt,
      ...(value !== undefined ? { value } : {}),
      ...(parsedBillingCycle !== undefined
        ? { billingCycle: parsedBillingCycle }
        : {}),
      ...(autoRenew !== undefined ? { autoRenew } : {}),
      ...(noticePeriodDays !== undefined ? { noticePeriodDays } : {}),
      updatedById: identity.id,
    },
    include: contractDetailInclude,
  });

  await logContractActivity({
    contractId: contract.id,
    actorId: identity.id,
    type: ContractActivityType.RENEWED,
    description: "Contract renewed.",
    metadata: {
      previousEndDate: dateString(existing.endDate),
      newEndDate: dateString(endDate),
    },
  });

  return contract;
}

/* =============================================================================
 * TERMINATE
 * =============================================================================
 */

export async function terminateContract({
  identity,
  contractId,
  reason,
}: {
  identity: ContractIdentity;
  contractId: string;
  reason: string | null;
}) {
  assertCanManageContracts(identity);

  const existing = await requireContract(contractId);

  if (existing.status !== ContractStatus.ACTIVE) {
    throw new ContractApiError(
      409,
      "Only active contracts can be terminated.",
    );
  }

  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: ContractStatus.TERMINATED,
      updatedById: identity.id,
    },
    include: contractDetailInclude,
  });

  await logContractActivity({
    contractId: contract.id,
    actorId: identity.id,
    type: ContractActivityType.TERMINATED,
    description: reason,
  });

  return contract;
}

/* =============================================================================
 * CANCEL
 * =============================================================================
 */

export async function cancelContract({
  identity,
  contractId,
  reason,
}: {
  identity: ContractIdentity;
  contractId: string;
  reason: string | null;
}) {
  assertCanManageContracts(identity);

  const existing = await requireContract(contractId);

  if (
    existing.status !== ContractStatus.DRAFT &&
    existing.status !== ContractStatus.PENDING_SIGNATURE
  ) {
    throw new ContractApiError(
      409,
      "Only draft or pending contracts can be cancelled. Terminate an active contract instead.",
    );
  }

  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: ContractStatus.CANCELLED,
      updatedById: identity.id,
    },
    include: contractDetailInclude,
  });

  await logContractActivity({
    contractId: contract.id,
    actorId: identity.id,
    type: ContractActivityType.CANCELLED,
    description: reason,
  });

  return contract;
}

/* =============================================================================
 * DOCUMENT
 * =============================================================================
 */

export async function replaceContractDocument({
  identity,
  contractId,
  name,
  url,
  mimeType,
  sizeBytes,
}: {
  identity: ContractIdentity;
  contractId: string;
  name: string;
  url: string;
  mimeType: string | null;
  sizeBytes: bigint | null;
}) {
  assertCanManageContracts(identity);

  const existing = await requireContract(contractId);

  if (
    existing.status === ContractStatus.TERMINATED ||
    existing.status === ContractStatus.CANCELLED
  ) {
    throw new ContractApiError(
      409,
      "A terminated or cancelled contract cannot have its document replaced.",
    );
  }

  const activityType = existing.documentUrl
    ? ContractActivityType.DOCUMENT_REPLACED
    : ContractActivityType.DOCUMENT_ADDED;

  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      documentName: name,
      documentUrl: url,
      documentMimeType: mimeType,
      documentSizeBytes: sizeBytes,
      updatedById: identity.id,
    },
    include: contractDetailInclude,
  });

  await logContractActivity({
    contractId: contract.id,
    actorId: identity.id,
    type: activityType,
    description:
      activityType === ContractActivityType.DOCUMENT_ADDED
        ? "Document added."
        : "Document replaced.",
  });

  return contract;
}
