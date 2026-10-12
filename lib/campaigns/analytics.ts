// lib/campaigns/analytics.ts
//
// KPIs, metrics and reporting. Every metric carries real provenance
// (campaign, channel, type, period, source, who recorded/imported it) —
// nothing here is fabricated, and a metric a connected platform can't
// actually provide is simply absent rather than guessed. CSV import is a
// tiny inline parser (no CSV library is installed in this project) with
// an explicit duplicate-row guard per import batch, since a nullable-
// column DB unique constraint can't fully dedupe this shape on its own.

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import { CampaignActivityType, CampaignKpiStatus, CampaignMetricSource, CampaignMetricType } from "@/app/generated/prisma/enums";
import { AccessAction, campaignOwnScopeFilter, type ResolvedIdentity } from "@/lib/campaigns/permissions";
import { logCampaignActivity } from "@/lib/campaigns/activity";
import { getCampaignOrThrow } from "@/lib/campaigns/server";

const ADMIN_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

/* ============================================================================
   KPIs
============================================================================ */

export function computeKpiStatus(targetValue: number, actualValue: number, deadline: Date | null): CampaignKpiStatus {
  if (actualValue >= targetValue) return "ACHIEVED";
  if (deadline && deadline < new Date()) return "MISSED";
  if (deadline) {
    const daysLeft = (deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    const progress = targetValue > 0 ? actualValue / targetValue : 0;
    // Behind a straight-line pace to the deadline counts as at risk —
    // not a guess at WHY, just a real comparison of progress vs time left.
    if (daysLeft <= 7 && progress < 0.8) return "AT_RISK";
  }
  return "ON_TRACK";
}

export async function listCampaignKpis(campaignId: string) {
  await getCampaignOrThrow(campaignId);
  return prisma.campaignKpi.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } });
}

export type KpiInput = { name: string; metric: CampaignMetricType; targetValue: number; deadline?: Date | null };

export async function createCampaignKpi(identity: ResolvedIdentity, campaignId: string, input: KpiInput) {
  await getCampaignOrThrow(campaignId);

  return prisma.campaignKpi.create({
    data: {
      campaignId,
      name: input.name,
      metric: input.metric,
      targetValue: input.targetValue,
      deadline: input.deadline ?? null,
      status: computeKpiStatus(input.targetValue, 0, input.deadline ?? null),
      createdById: identity.admin.id,
      updatedById: identity.admin.id,
    },
  });
}

export async function updateCampaignKpi(
  identity: ResolvedIdentity,
  campaignId: string,
  kpiId: string,
  input: Partial<KpiInput> & { actualValue?: number },
) {
  const existing = await prisma.campaignKpi.findUnique({ where: { id: kpiId } });
  if (!existing || existing.campaignId !== campaignId) throw new AuthorisationError("This KPI could not be found.");

  const targetValue = input.targetValue ?? Number(existing.targetValue);
  const actualValue = input.actualValue ?? Number(existing.actualValue);
  const deadline = input.deadline !== undefined ? input.deadline : existing.deadline;

  return prisma.campaignKpi.update({
    where: { id: kpiId },
    data: { ...input, status: computeKpiStatus(targetValue, actualValue, deadline), updatedById: identity.admin.id },
  });
}

export async function deleteCampaignKpi(campaignId: string, kpiId: string) {
  const existing = await prisma.campaignKpi.findUnique({ where: { id: kpiId } });
  if (!existing || existing.campaignId !== campaignId) throw new AuthorisationError("This KPI could not be found.");
  await prisma.campaignKpi.delete({ where: { id: kpiId } });
}

/* ============================================================================
   METRICS
============================================================================ */

export type MetricInput = {
  channel?: "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "X" | "TIKTOK" | "YOUTUBE" | "EMAIL" | "WEBSITE" | "PRINT" | "EVENTS" | "OTHER" | null;
  metricType: CampaignMetricType;
  value: number;
  periodStart: Date;
  periodEnd: Date;
  source: CampaignMetricSource;
  sourcePostId?: string | null;
  externalReference?: string | null;
};

async function isDuplicateMetric(campaignId: string, input: MetricInput): Promise<boolean> {
  const existing = await prisma.campaignMetric.findFirst({
    where: {
      campaignId,
      channel: input.channel ?? null,
      metricType: input.metricType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      source: input.source,
      externalReference: input.externalReference ?? null,
    },
  });
  return Boolean(existing);
}

export async function recordCampaignMetric(identity: ResolvedIdentity, campaignId: string, input: MetricInput) {
  await getCampaignOrThrow(campaignId);

  if (input.periodEnd < input.periodStart) {
    throw new AuthorisationError("The period end cannot be before the period start.");
  }
  if (await isDuplicateMetric(campaignId, input)) {
    throw new AuthorisationError("A metric for this exact channel, type, period and source already exists.");
  }

  const metric = await prisma.campaignMetric.create({
    data: { ...input, campaignId, recordedById: identity.admin.id },
  });

  // KPIs tracking this exact metric type get their actualValue refreshed
  // from the real sum of all recorded metrics of that type — never from
  // this one row alone, so re-imports and multiple channels add up
  // correctly instead of overwriting each other.
  const total = await prisma.campaignMetric.aggregate({
    where: { campaignId, metricType: input.metricType },
    _sum: { value: true },
  });
  const matchingKpis = await prisma.campaignKpi.findMany({ where: { campaignId, metric: input.metricType } });
  for (const kpi of matchingKpis) {
    const actualValue = Number(total._sum.value ?? 0);
    await prisma.campaignKpi.update({
      where: { id: kpi.id },
      data: { actualValue, status: computeKpiStatus(Number(kpi.targetValue), actualValue, kpi.deadline) },
    });
  }

  return metric;
}

export async function listCampaignMetrics(campaignId: string, filters: { metricType?: CampaignMetricType | null; channel?: string | null }) {
  await getCampaignOrThrow(campaignId);
  return prisma.campaignMetric.findMany({
    where: { campaignId, ...(filters.metricType ? { metricType: filters.metricType } : {}), ...(filters.channel ? { channel: filters.channel as never } : {}) },
    orderBy: { periodStart: "desc" },
    include: { recordedBy: { select: ADMIN_SELECT } },
  });
}

/* ============================================================================
   CSV IMPORT

   Minimal RFC4180-ish parser: handles quoted fields and escaped quotes,
   comma-delimited. No external CSV library is installed in this project.
============================================================================ */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
      }
      row = [];
      field = "";
      if (char === "\r" && next === "\n") i++;
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Expected header: channel,metricType,value,periodStart,periodEnd,externalReference
 *  channel and externalReference may be blank. Every successfully parsed
 *  row is recorded with source=CSV_IMPORT and runs through the same
 *  duplicate guard as a single manual entry. */
export async function importCampaignMetricsCsv(identity: ResolvedIdentity, campaignId: string, csvText: string, filename: string) {
  await getCampaignOrThrow(campaignId);

  const rows = parseCsv(csvText.trim());
  if (rows.length < 2) {
    throw new AuthorisationError("The CSV file has no data rows.");
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const requiredColumns = ["metrictype", "value", "periodstart", "periodend"];
  if (!requiredColumns.every((col) => header.includes(col))) {
    throw new AuthorisationError(`The CSV must include columns: ${requiredColumns.join(", ")} (channel and externalReference are optional).`);
  }

  const col = (name: string) => header.indexOf(name);
  let imported = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const rowNumber = i + 1;
    const cells = rows[i];
    try {
      const metricType = cells[col("metrictype")]?.trim().toUpperCase() as CampaignMetricType | undefined;
      if (!metricType || !(Object.values(CampaignMetricType) as string[]).includes(metricType)) {
        throw new Error(`invalid metricType "${cells[col("metrictype")]}"`);
      }

      const value = Number(cells[col("value")]);
      if (!Number.isFinite(value)) throw new Error("invalid value");

      const periodStart = new Date(cells[col("periodstart")]);
      const periodEnd = new Date(cells[col("periodend")]);
      if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) throw new Error("invalid period dates");

      const channelRaw = col("channel") >= 0 ? cells[col("channel")]?.trim().toUpperCase() : "";
      const externalReference = col("externalreference") >= 0 ? cells[col("externalreference")]?.trim() || null : null;

      await recordCampaignMetric(identity, campaignId, {
        channel: channelRaw ? (channelRaw as MetricInput["channel"]) : null,
        metricType,
        value,
        periodStart,
        periodEnd,
        source: "CSV_IMPORT",
        externalReference,
      });
      imported += 1;
    } catch (error) {
      errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : "could not be imported"}`);
    }
  }

  const importRecord = await prisma.campaignMetricImport.create({
    data: {
      campaignId,
      importedById: identity.admin.id,
      filename,
      rowCount: imported,
      status: errors.length === 0 ? "COMPLETED" : imported > 0 ? "COMPLETED_WITH_ERRORS" : "FAILED",
      errorSummary: errors.length > 0 ? errors.slice(0, 20).join("; ") : null,
    },
  });

  await logCampaignActivity(campaignId, identity.admin.id, CampaignActivityType.METRIC_IMPORTED, `Imported ${imported} metrics from ${filename}.`);

  return { import: importRecord, imported, errors };
}

export async function listCampaignMetricImports(campaignId: string) {
  await getCampaignOrThrow(campaignId);
  return prisma.campaignMetricImport.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    include: { importedBy: { select: ADMIN_SELECT } },
  });
}

/* ============================================================================
   DASHBOARD
============================================================================ */

export async function getCampaignAnalyticsDashboard(campaignId: string) {
  await getCampaignOrThrow(campaignId);

  const [kpis, byType, byChannel, hasAnyMetrics] = await Promise.all([
    prisma.campaignKpi.findMany({ where: { campaignId } }),
    prisma.campaignMetric.groupBy({ by: ["metricType"], where: { campaignId }, _sum: { value: true } }),
    prisma.campaignMetric.groupBy({ by: ["channel"], where: { campaignId }, _sum: { value: true } }),
    prisma.campaignMetric.count({ where: { campaignId } }),
  ]);

  return {
    hasMetrics: hasAnyMetrics > 0,
    kpis,
    byType: byType.map((row) => ({ metricType: row.metricType, value: Number(row._sum.value ?? 0) })),
    byChannel: byChannel.map((row) => ({ channel: row.channel, value: Number(row._sum.value ?? 0) })),
  };
}

/** Ranks campaigns by the total of ONE metric type within a date range —
 *  "performance" has no single universal number, so the caller must pick
 *  which metric defines it. Campaigns with no recorded metrics of that
 *  type are simply absent from the ranking, never scored as zero. */
/** identity's own OWN/DEPARTMENT scope is applied via the campaign
 *  relation filter — a restricted caller never sees another campaign's
 *  name or performance leak into this cross-campaign ranking. */
export async function rankCampaignsByMetric(identity: ResolvedIdentity, metricType: CampaignMetricType, from: Date, to: Date, limit = 10) {
  const ownFilter = campaignOwnScopeFilter(identity, AccessAction.VIEW);

  const rows = await prisma.campaignMetric.groupBy({
    by: ["campaignId"],
    where: { metricType, periodStart: { gte: from }, periodEnd: { lte: to }, campaign: ownFilter ?? {} },
    _sum: { value: true },
    orderBy: { _sum: { value: "desc" } },
    take: limit,
  });

  const campaigns = await prisma.campaign.findMany({ where: { id: { in: rows.map((r) => r.campaignId) } }, select: { id: true, name: true } });
  const nameById = new Map(campaigns.map((c) => [c.id, c.name]));

  return rows.map((row) => ({ campaignId: row.campaignId, name: nameById.get(row.campaignId) ?? "Unknown", value: Number(row._sum.value ?? 0) }));
}

/* ============================================================================
   CSV EXPORT — real data only, never fabricated rows
============================================================================ */

function toCsvRow(values: Array<string | number>): string {
  return values.map((v) => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v))).join(",") + "\n";
}

export async function exportCampaignSummaryCsv(campaignId: string): Promise<string> {
  const campaign = await getCampaignOrThrow(campaignId);
  let csv = toCsvRow(["Field", "Value"]);
  csv += toCsvRow(["Name", campaign.name]);
  csv += toCsvRow(["Status", campaign.status]);
  csv += toCsvRow(["Objective", campaign.objective ?? ""]);
  csv += toCsvRow(["Start date", campaign.startDate?.toISOString() ?? ""]);
  csv += toCsvRow(["End date", campaign.endDate?.toISOString() ?? ""]);
  csv += toCsvRow(["Budget", campaign.budget != null ? Number(campaign.budget) : ""]);
  csv += toCsvRow(["Currency", campaign.currency]);
  return csv;
}

export async function exportCampaignBudgetCsv(campaignId: string): Promise<string> {
  const expenses = await prisma.campaignExpense.findMany({ where: { campaignId }, orderBy: { expenseDate: "asc" } });
  let csv = toCsvRow(["Date", "Description", "Category", "Amount", "Currency", "Payment status", "Approval status"]);
  for (const e of expenses) {
    csv += toCsvRow([e.expenseDate.toISOString().slice(0, 10), e.description, e.category, Number(e.amount), e.currency, e.paymentStatus, e.approvalStatus]);
  }
  return csv;
}

export async function exportCampaignPerformanceCsv(campaignId: string): Promise<string> {
  const metrics = await prisma.campaignMetric.findMany({ where: { campaignId }, orderBy: { periodStart: "asc" } });
  let csv = toCsvRow(["Period start", "Period end", "Channel", "Metric", "Value", "Source"]);
  for (const m of metrics) {
    csv += toCsvRow([m.periodStart.toISOString().slice(0, 10), m.periodEnd.toISOString().slice(0, 10), m.channel ?? "", m.metricType, Number(m.value), m.source]);
  }
  return csv;
}
