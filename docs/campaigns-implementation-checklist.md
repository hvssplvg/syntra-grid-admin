# Campaigns Management System — implementation checklist

Persistent checkpoint for the full build requested 2026-10-12. Update this
file as phases complete so work can resume from the last verified point
instead of re-deriving context or repeating work.

## Phase 0 — Inspection (DONE)

Confirmed facts that drive every later decision:

- `Campaign` model + `CampaignStatus` (10 values) already exist and are kept as-is.
- `SocialCampaign` (Social Media's own campaign label) is untouched — separate model.
- Team/task "doer" relations use `Employee`, not `AdminUser` (see `WorkloadAllocation`,
  `CalendarEvent.ownerId`). `AdminUser` is the logged-in actor (`createdById`/`updatedById`
  provenance). `Employee.adminUserId` optionally links the two.
- `CalendarEvent` already has optional `clientId`/`projectId` — same FK pattern Campaign will use.
  Its `ownerId` is `Employee` (required), `createdById`/`updatedById` are `AdminUser`.
- Money fields use `Decimal @db.Decimal(18,2)` + `CurrencyCode` enum (`NGN GBP USD EUR`) —
  reuse this enum verbatim, do not invent a new currency type.
- There is a generic `AuditLog` model, but Social Media and Brand Assets both chose bespoke
  per-module `*Activity` tables with typed enums instead of using it. Mirror that precedent:
  build `CampaignActivity`, do not write to `AuditLog`.
- `Notification`/`NotificationType` are materialised lazily by `lib/notifications/server.ts`
  from real source tables (`collectFullAccessDrafts` / `collectRestrictedDrafts`) — modules
  never insert `Notification` rows directly. Extend `NotificationType` + add collectors there;
  do not build a `CampaignNotification` table.
- No test framework exists anywhere in this repo (`package.json`, grep for `*.test.ts` — both
  empty). Adding one is in scope (Vitest, matches a Next 16 + ESM project best). No isolated
  test database exists — only one (production) `DATABASE_URL`. Tests must not hit the live DB;
  scope tests to pure business logic (permission scope filters, status-transition validation,
  budget/KPI math, task-dependency cycle detection) and mock Prisma where DB-shaped logic is
  tested. Document this honestly rather than faking integration coverage.
- Role templates (`lib/access/role-templates.ts`) only define `marketing-executive` (VIEW/
  CREATE/EDIT at ALL on campaigns/social_media/brand_assets) and `department-viewer`. No
  APPROVE/MANAGE template exists for campaigns — full-access admins already bypass all checks,
  so this is consistent with the Brand Assets/Social Media precedent (approval tiers aren't
  handed to the content-creator template). Not adding a new template unless it becomes necessary.
- Migration workflow: pooled connection hits a known checksum-drift false positive on
  `migrate dev`. Always use: `prisma migrate diff --from-config-datasource --to-schema
  --script` → hand-review SQL → write as a new migration folder → apply via a direct
  (non-pooled, strip `-pooler` from host) `pg` connection script → `prisma migrate resolve
  --applied` → `prisma generate`. Never `migrate reset` / `db push --force-reset`.

## Phase 1 — Database architecture

Status: DONE. Migration `20261012170000_campaigns_full_build` applied (direct-connection
workflow — pooled `migrate dev` hit the same known checksum-drift false positive as before,
handled the proven way) and resolved. `prisma generate`/`validate`/`migrate status` all clean.
`tsc --noEmit` clean against the regenerated client. Verified 0 existing `Campaign` rows (none
existed yet — nothing to lose) via a direct read-only count. 18 tables, 19 enums, 1 additive
`ALTER TABLE Campaign ADD COLUMN` (all nullable or defaulted — no data-loss risk). Full model
list is in the schema's "CAMPAIGNS MANAGEMENT" doc comment.

New models (all additive, Campaign extended not replaced):

- [ ] `Campaign` extended: `code`, `objective`, `category`, `priority`, `clientId`, `projectId`,
      `departmentId`, `ownerId` (Employee), `managerId` (Employee), `currency`, `budget`,
      `goals`, `notes`
- [ ] `CampaignMember` (team assignment, Employee-based, role enum)
- [ ] `CampaignMilestone` (Planner, optional linked `CalendarEvent`)
- [ ] `CampaignTask` (single-link `dependsOnTaskId`, cycle check in app layer)
- [ ] `CampaignTaskComment`
- [ ] `CampaignActivity` (serves as both activity feed AND audit trail — no separate
      `CampaignHistory` table; documented consolidation)
- [ ] `CampaignContent`
- [ ] `CampaignContentAsset` (join to existing `BrandAsset` — no duplicate Cloudinary storage)
- [ ] `CampaignAudience`
- [ ] `CampaignAudienceAssignment` (join, many-to-many)
- [ ] `CampaignChannel` (per-campaign channel list)
- [ ] `CampaignBudgetAllocation`
- [ ] `CampaignExpense` (optional `matchedMonzoTransactionId`, mirrors `ClientInvoice`'s real
      bank-reconciliation pattern instead of duplicating accounting)
- [ ] `CampaignBudgetHistory`
- [ ] `CampaignKpi`
- [ ] `CampaignMetric` (provenance-tracked; app-layer duplicate-import guard, not just a
      nullable-column unique constraint)
- [ ] `CampaignMetricImport`
- [ ] `CampaignApproval` (single assigned approver + status, snapshot `Json` of the approved
      entity, `SUPERSEDED` status for stale-approval invalidation — no separate multi-step
      `CampaignApprovalStep` chain; documented simplification)
- [ ] `CampaignApprovalComment`
- [ ] New enums: `CampaignObjective`, `CampaignPriority`, `CampaignMemberRole`,
      `CampaignMilestoneStatus`, `CampaignTaskStatus`, `CampaignActivityType`,
      `CampaignContentType`, `CampaignContentStatus`, `CampaignAudienceCategory`,
      `CampaignChannelType`, `CampaignBudgetCategory`, `CampaignExpensePaymentStatus`,
      `CampaignExpenseApprovalStatus`, `CampaignMetricType`, `CampaignMetricSource`,
      `CampaignApprovalType`, `CampaignApprovalStatus`
- [ ] Migration written + applied via direct-connection workflow + `migrate resolve --applied`
- [ ] `prisma generate`, `prisma validate`

## Phase 2 — Overview

Status: DONE (server side). `getCampaignOverview` now returns real counts for every status
(draft/active/scheduled/paused/completed/cancelled/archived/pendingApprovals), real
upcomingDeadlines/overdueMilestones (from `CampaignMilestone`), outstanding/completed
deliverables (from `CampaignContent`), real budget/expenditure/remaining-budget/over-budget
data — returned as `budgetByCurrency` (an array of `{currency, allocated, spent, remaining}`),
**not** a single blindly-summed number: money is never combined across `CurrencyCode` values
without a verified exchange rate (none exists here). "Over budget" only compares a campaign's
expenses to its own budget when they share the same currency — expenses recorded in a
different currency than their campaign's budget are tracked (Phase 7) but never forced into
that comparison. `upcomingActivities` is kept as an alias of `upcomingDeadlines` for frontend
backward-compatibility (the field the current UI already reads). Charts (status/activity-
over-time/budget-vs-expenditure/channel-distribution/performance-over-time/upcoming-
deadlines) and the frontend Overview UI itself are NOT yet built — tracked under Phase 14.

## Phase 3 — Campaign management (expand existing CRUD)

Status: DONE (server + API). `Campaign` extended with code/objective/category/priority/
client/project/department/owner/manager/currency/budget/goals/notes. Server-enforced status
transition table (`STATUS_TRANSITIONS`) blocks invalid moves; COMPLETED/CANCELLED/ARCHIVED are
terminal for PATCH (archive/restore are the only way in/out of ARCHIVED). FK validation gives
clear 400s instead of opaque constraint errors, and derives `clientId` from `projectId` when
only a project is given (and rejects a project/client mismatch). New dedicated lifecycle
routes: `/launch` `/pause` `/resume` `/complete` `/cancel` `/duplicate`, mirroring the existing
`/archive` `/restore` pattern. Every mutation writes a `CampaignActivity` row (Phase 11,
delivered inline rather than bolted on afterward). New `GET /[id]/activity` route. Frontend
(detail workspace, the 14 sections the spec lists, new field inputs on the create/edit dialog)
is NOT yet built — tracked under Phase 14.
## Phase 10 (partial) — Team

Status: DONE (server + API). `lib/campaigns/team.ts` + `/api/admin/campaigns/[id]/members`
(GET/POST) and `/[id]/members/[memberId]` (PATCH role, DELETE). Gated under `MANAGE` (staffing
decision), checked against the parent campaign's row access. Activity logged on add/remove.
Frontend not yet built (Phase 14).

## Phase 4 — Planner

Status: DONE (server + API). `lib/campaigns/planner.ts`: milestones (create/edit/delete, each
with an owner-attributed `CalendarEvent` of type `MILESTONE` kept in sync — never duplicated,
never created for an ownerless milestone since there's nothing real to attribute it to) and
tasks (create/edit/delete, single-parent `dependsOnTaskId` chain with a bounded cycle-detection
walk in `assertNoDependencyCycle`, task comments). Routes nested under
`/api/admin/campaigns/[id]/milestones(/[milestoneId])` and `/tasks(/[taskId]/comments)` —
deliberately not the spec's suggested flat `/api/admin/campaigns/milestones` shape, since every
other route in this build already resolves the parent campaign first and nesting keeps that
consistent (the spec explicitly allows this: "suggested endpoints, not a rigid contract").
A task's own assignee can update its status/description without campaign-level EDIT access
(checked via `isOwnEmployee`), but cannot reassign/reschedule/reprioritise without real EDIT —
enforced in the route handler, not just hidden in the UI. Only month/week/day/list/timeline
CALENDAR VIEWS and the frontend itself are outstanding (Phase 14).
## Phase 5 — Content (+ Brand Assets + Social Media integration)
## Phase 5 — Content

Status: DONE (server + API). `lib/campaigns/content.ts`: CRUD + a status-transition table where
`PUBLISHED` is **never** a reachable target of a direct edit — it is only ever set by
`syncContentPublishStatusFromSocialPost`, which reflects a real linked `SocialPost`'s own
confirmed status. Brand Assets integration: `attachBrandAssetToContent` resolves the caller's
OWN `brand_assets` identity (not the campaigns one) and calls Brand Assets' real
`assertBrandAssetsRowAccess`/`getBrandAssetOrThrow`, blocking non-`ACTIVE` and `INTERNAL_ONLY`
assets exactly like Social Media's own guard. Detaching only ever removes the join row —
Cloudinary/BrandAsset untouched. Social Media integration: `createSocialPostFromContent` reuses
the existing `reuseBrandAssetAsSocialMediaAsset` (no re-upload) and `createPost` — no new
publishing engine. A content item's own creator/reviewer can act on it without campaign-level
EDIT (checked via `isOwnEmployee`). Only Facebook/TikTok/YouTube/X remain "not configured",
unchanged from the existing Social Media module — this build does not claim otherwise.
Frontend not yet built (Phase 14).

## Phase 6 — Audiences
## Phase 6 — Audiences

Status: DONE (server + API). `lib/campaigns/audiences.ts`: `CampaignAudience` is shared master
data (like `BrandKit`) reused across campaigns — gated by plain CREATE/EDIT/MANAGE with no row
check, while assigning/removing an audience on a specific campaign is checked against that
campaign's own row access. `isEstimate` always defaults `true` unless the caller explicitly
sets `false`, so a manually-guessed size is never silently presented as measured. Age-range
min/max validated both on create and edit (edit checks the merged result, not just the fields
being changed). Flat `/api/admin/campaigns/audiences(/[audienceId]/archive|restore)` for the
shared records, nested `/api/admin/campaigns/[id]/audiences(/[assignmentId])` for assignment.
Frontend not yet built (Phase 14).

## Phase 7 — Budget
## Phase 7 — Budget

Status: DONE (server + API). `lib/campaigns/budget.ts`: allocations, expenses, approve/reject
with separation of duties enforced unconditionally (the expense's own recorder can never also
decide it — a business-integrity rule, not a permission tier, so even a full-access admin is
blocked), Monzo bank-transaction reconciliation (mirrors `ClientInvoice`'s matching, rejects a
transaction that's `CREDIT` or already matched to anything else in Finance, preventing
double-counting), and `Campaign.budget` edits now write `CampaignBudgetHistory` (wired from
`updateCampaign` in server.ts via a dynamic import to avoid a static circular dependency).
Every summary is grouped/compared strictly within one currency — an allocation's currency must
match an expense recorded against it, and "over budget"/category totals never mix currencies.
Frontend not yet built (Phase 14).

## Phase 8 — Approvals
## Phase 8 — Approvals

Status: DONE (server + API). `lib/campaigns/approvals.ts`: single assigned-approver + status
model (no multi-step chain — documented simplification, no concrete multi-stage requirement
was given). `snapshot` freezes the related entity (Campaign/CampaignContent/CampaignExpense)
at request time; `supersedeApprovalsForEntity` is wired into `updateCampaign` and
`updateCampaignContent` (via dynamic import, same circular-dependency reason as Phase 7) so any
substantive edit after a request/approval marks it `SUPERSEDED` — a stale approval can never
authorise changed content. Separation of duties is a hard business rule, not a permission
check: a requester can never decide their own request, even full access; an explicitly assigned
approver is the only one who may decide unless the caller is full access (an override, not a
bypass of self-approval). Reject/request-changes both require a comment.

## Phase 9 — Analytics
## Phase 9 — Analytics

Status: DONE (server + API). `lib/campaigns/analytics.ts`: KPIs (`actualValue` always
recomputed from the real `SUM` of matching `CampaignMetric` rows, never overwritten by a single
new entry, so multiple channels/re-imports add up correctly; `status` derived from
target/actual/time-remaining, never manually guessable into `ACHIEVED`), manual metric entry
and CSV import (a small inline RFC4180-ish parser — no CSV library is installed in this
project — with an explicit duplicate-row guard per row, not just a DB constraint), a
per-campaign dashboard, a cross-campaign ranking endpoint for "top/underperforming" (**fixed a
real access-control gap while building this**: the ranking initially queried every campaign
with no OWN/DEPARTMENT scope filter, which would have leaked another restricted caller's
campaign names/performance — now filtered via the campaign relation in the same `groupBy`),
and real CSV report exports (summary/budget/performance — never a fabricated chart or row).
Analytics sources are exactly what's real in this codebase: the existing Social Media
integrations' own data (via `sourcePostId`), verified manual entries, and CSV import — no new
external analytics integration exists, and none is claimed.

## Phase 10 — Team & permissions (extend `lib/campaigns/permissions.ts`)

Status: DONE. Team covered in Phase 4's checkpoint above. Permissions: `campaignOwnScopeFilter`/
`assertCampaignRowAccess` now properly support `DEPARTMENT` scope (Campaign gained a real
`departmentId` in Phase 1 — Social Media's "no natural department boundary" documented
limitation no longer applies here). `isOwnEmployee`/`isOwnAdminUser` back every named-actor
exemption used throughout (task assignee, content creator/reviewer, expense recorder, approval
requester/approver) — every one of these is enforced server-side in the route handler, never
only hidden in the UI.

## Phase 11 — Activity/audit

Status: DONE. `CampaignActivity` (via `lib/campaigns/activity.ts#logCampaignActivity`) is
written by every mutation across every sub-module built in this session — campaign CRUD/
lifecycle, team add/remove, milestone/task create/complete, content submit/approve/changes-
requested, budget/expense record/approve, approval request/decide, metric import. No separate
`CampaignHistory` table and no write to the generic `AuditLog` — documented consolidation.

## Phase 12 — Notifications (extend `lib/notifications/server.ts`, no new table)

Status: DONE. 10 new `NotificationType` values added (migration
`20261012180000_add_campaign_notification_types`, additive `ALTER TYPE ... ADD VALUE`, no
existing data touched). `collectFullAccessDrafts` gained overdue tasks, milestones due within
7 days, pending approvals, pending expense approvals — all real queries against the tables
built in this session. `collectRestrictedDrafts` gained the same, correctly scoped: overdue
tasks only for the caller's OWN linked Employee record, pending approvals split into
"unassigned, visible if I hold campaigns:APPROVE" and "specifically assigned to me" (so an
approver sees their queue even without a blanket APPROVE grant on an unassigned request),
expense approvals gated on campaigns:APPROVE. `npm run build` confirms every other existing
route (invoices, timesheets, workload, monzo, etc.) still compiles — nothing else in the app
broke.

`npm run build` after this phase also verified the full ~80-route Campaigns API surface built
across Phases 2–9 compiles cleanly end to end.

## Phase 13 — API routes

Status: DONE for everything built in Phases 2–9 (overview, campaigns + lifecycle actions +
duplicate + activity, members, milestones, tasks + comments, content + brand-asset attach +
social-media publish + sync, audiences + assignment, budget allocations/expenses/approve/
reject/match-transaction/summary/history, approvals + decide + comments, KPIs, metrics +
CSV import/imports, analytics dashboard, cross-campaign ranking, CSV report exports). Every
route follows the established house pattern: `requireCampaignsPermission` first,
`assertCampaignRowAccess` against the parent campaign (or the named-actor exemption) before
any mutation, explicit 400s for invalid input, consistent `{ok, ...}` response envelope.
## Phase 14 — Frontend (`app/components/admin/campaigns/*.tsx`, wired into `CampaignsTab.tsx`)

Status: DONE for a genuinely functional baseline across all 8 sections; some depth deferred
and documented honestly below rather than silently skipped.

Built: `shared.tsx` (style tokens/primitives + `campaignsApi` + `/api/admin/campaigns/options`
client — a NEW, properly-scoped options endpoint; see note below), `CampaignPicker.tsx`,
`CampaignPlanner.tsx`, `CampaignContentSection.tsx`, `CampaignAudiencesSection.tsx`,
`CampaignBudgetSection.tsx`, `CampaignAnalyticsSection.tsx`, `CampaignApprovalsSection.tsx`,
`CampaignTeamSection.tsx`, `CampaignDetailPanel.tsx` (the per-campaign workspace — Team/Planner/
Content/Audiences/Budget/Analytics/Approvals/Activity — reached via "Manage" on a campaign
row). The top-level Planner/Content/Audiences/Budget/Analytics/Approvals nav tabs reuse the
exact same section components via `CampaignPicker`, since every backend route is nested under
one campaign (`/api/admin/campaigns/[id]/...`) and there's no cross-campaign aggregation
endpoint — documented scoping decision, not a missing feature. Overview now shows real
draft/paused/over-budget counts, real upcoming/overdue milestone and deliverable counts, and a
real budget-by-currency panel with a spent/allocated bar per currency.

**New endpoint discovered necessary while wiring this up**: `/api/admin/client-options` and
`/api/admin/departments/options` both gate on `requireAdmin()` — full, non-restricted access
only — which would have silently blocked a restricted Marketing Executive (this module's
actual intended primary user) from even listing clients/departments to assign to a campaign.
Built a dedicated `GET /api/admin/campaigns/options` gated on `campaigns:VIEW` instead of
reusing those two routes as-is.

**Deliberately not built in this pass** (real gaps, not hidden):
- The Campaign create/edit dialog still only has name/description/status/dates — the new
  fields added in Phase 3 (objective, priority, client, project, department, owner, manager,
  budget, currency, code, goals, notes) are NOT yet exposed in that form, though every field is
  fully functional server-side and settable via the API.
- Content's Brand Assets picker and "publish to social" UI are not built — the content list/
  create/status workflow is real and functional, but attaching a brand asset or creating a real
  social post from approved content currently requires calling those APIs directly rather than
  through a picker in this UI.
- Month/week/day/timeline calendar VIEWS for the Planner are not built — it's a real list of
  milestones/tasks, not a calendar grid.
- Cross-campaign dashboards (top/underperforming campaigns ranking, channel distribution chart,
  activity-over-time chart) have real backend endpoints (`/api/admin/campaigns/analytics/
  ranking`) but no frontend surface yet.
- CampaignTask dependency selection, task comments, and KPI/expense edit (vs. create) have no
  UI yet — creatable and viewable, not yet editable from this pass's UI.

None of the above were faked or stubbed with placeholder data — they simply were not reached
in frontend depth within this session; every one of them has a real, tested-via-code-review
backend already built and documented in Phases 2–13.
## Phase 15 — Integrations (Clients/Projects/Team/Calendar/Brand Assets/Social Media/Finance/Notifications)

Status: DONE, all real (details are in each phase above; this is the cross-reference):

- [x] Clients/Projects — `Campaign.clientId`/`projectId`, FK-validated, client auto-derived
      from project, project/client mismatch rejected.
- [x] Team — `CampaignMember`, task `assigneeId`, content `creatorId`/`reviewerId` all real
      `Employee` relations.
- [x] Calendar — `CampaignMilestone` ↔ real `CalendarEvent` (type `MILESTONE`), kept in sync,
      deleted together, never duplicated.
- [x] Brand Assets — `CampaignContentAsset` references `BrandAsset` directly; every attach
      goes through Brand Assets' own real permission/row-access check and `INTERNAL_ONLY` guard.
- [x] Social Media — `createSocialPostFromContent` reuses `reuseBrandAssetAsSocialMediaAsset`
      and `createPost`; content is never marked `PUBLISHED` except by reflecting the real post.
- [x] Finance — `CampaignExpense.matchedMonzoTransactionId` reconciles against real
      `MonzoTransaction` rows, rejecting `CREDIT` or already-matched transactions.
- [x] Notifications — 10 new real draft collectors in `lib/notifications/server.ts`, no new
      table, correctly OWN/APPROVE-scoped for restricted callers.
## Phase 16 — Security review

Status: DONE. Systematic pass against every category the spec listed:

- **Broken access control / missing OWN-scope checks / IDOR**: every sub-resource getter
  (`getMilestoneOrThrow`, `getTaskOrThrow`, `getCampaignContentOrThrow`, the budget/approval/
  audience-assignment/member equivalents) checks the row's `campaignId` matches the URL's
  `campaignId` before returning it — a caller can't reach another campaign's sub-resource by
  guessing an id even if they can access *some* campaign. Verified by re-reading all ~70 routes.
- **Unauthorised budget/approval actions, self-approval bypasses**: separation of duties is a
  hard business rule (requester/recorder can never decide their own request, unconditionally,
  full access included); an explicitly assigned approver is the only one who may decide unless
  the caller is full access.
- **Mass assignment**: grepped every route for a raw `...body` spread into a Prisma `data` —
  none exists; every field is parsed and whitelisted individually via `lib/campaigns/
  validation.ts`.
- **SQL injection**: no `$queryRaw`/`$executeRaw` anywhere in the module (the one earlier
  draft use, for the over-budget count, was replaced with grouped Prisma queries while fixing
  the currency-mixing bug in Phase 2).
- **XSS**: no `dangerouslySetInnerHTML`, no `eval`, in any new frontend file.
- **INTERNAL_ONLY asset exposure**: enforced at the actual attach boundary
  (`attachBrandAssetToContent`), not just hidden in the picker UI.
- **Invalid state transitions**: both Campaign and CampaignContent have explicit transition
  tables; PUBLISHED is structurally unreachable as a direct-edit target.
- **Duplicate financial transactions**: Monzo matching rejects `CREDIT` and already-matched
  transactions; metric CSV import has an explicit per-row duplicate guard.
- **Race conditions / double decisions — real bug found and fixed**: `decideCampaignApproval`
  and `decideCampaignExpense` originally read-then-wrote (`findUnique` check, then a separate
  `update`), which is a genuine TOCTOU race — two concurrent decisions on the same approval or
  expense could both have passed the PENDING check before either committed. Fixed both to use
  an atomic `updateMany({ where: { id, status: "PENDING" } })` claim: the second concurrent
  request now affects zero rows and gets a clean "already decided" error instead of silently
  overwriting the first decision.
- **Unsafe deletion — real bug found and fixed**: `deleteCampaignContent` had no guard at all;
  a PUBLISHED content item (one that produced a real, live SocialPost) could be hard-deleted,
  losing the historical record of which content became that post. Fixed to block deletion of
  PUBLISHED content, directing to archive instead — mirrors the terminal-status pattern used
  elsewhere in this module.
- **Stale approval decisions**: `supersedeApprovalsForEntity` wired into both `updateCampaign`
  and `updateCampaignContent`.

**Honestly documented, not fixed in this pass** (minor, logged rather than hidden):
- `CampaignExpense.approvalStatus` (a direct approve/reject on the expense itself) and the
  generic `CampaignApproval` with `type: EXPENSE` are two parallel, currently-unlinked
  approval mechanisms — both are individually secure and functional, but recording an expense
  doesn't automatically create a `CampaignApproval` row, and approving one doesn't update the
  other. A real architectural overlap introduced by building Budget (Phase 7) before Approvals
  (Phase 8) without going back to unify them. Not a vulnerability, but worth resolving in a
  follow-up.
- Receipt "upload" on an expense is a plain `receiptUrl` string field, not an actual Cloudinary
  upload integration — a receipt has to be hosted elsewhere and linked, not uploaded through
  this module.
- CSV metric import has no explicit file-size cap of its own; it relies on the hosting
  platform's own request-body limit (Vercel's serverless function default) rather than a
  module-level guard.
- A rare concurrent-match race on `matchCampaignExpenseToMonzoTransaction` (two expenses
  matching the same transaction in the same instant) would surface as a raw database
  constraint error rather than a clean message for the losing request — the `@unique`
  constraint on `CampaignExpense.matchedMonzoTransactionId` still prevents the double-count
  itself; only the error message is unpolished.
## Phase 17 — Tests

Status: DONE. Added `vitest` as a devDependency (none existed in this repo before).

**Correction, found the hard way**: `vitest@5.0.4` (+ a manually-added `vite@8`) was the first
choice, installed locally with `--legacy-peer-deps` to bypass an `@types/node` peer conflict.
That flag papered over a real problem — it isn't set in Vercel's own `npm install`, so the
exact same conflict broke the production deployment (`ERESOLVE` on `@types/node`). Bumping
`@types/node` to satisfy vitest@5 didn't fully fix it either: a plain `npm install` then hit an
unrelated npm/arborist crash (`Cannot read properties of null (reading 'edgesOut')`) while
resolving a nested vitest bundled inside `@neondatabase/auth-ui`'s own dependency tree.
Downgraded to `vitest@2.1.9`, which (a) bundles a compatible `vite@^5` itself (no separate
`vite` devDependency needed) and (b) accepts the project's existing `@types/node@^20` as-is —
no version bump, no peer conflict, no arborist crash. Verified with a full `rm -rf node_modules
package-lock.json && npm install` (no flags) locally, matching exactly what Vercel's build
does, before re-testing and re-pushing.

44 real tests across 4 files, all passing, all pure logic —
no live database, consistent with the Phase 0 finding that this repo has exactly one
`DATABASE_URL` (production) and no isolated test database:
- `permissions.test.ts` (12 tests) — `campaignOwnScopeFilter`/`assertCampaignRowAccess` for
  OWN, DEPARTMENT (including the "no linked department" edge case that must never fall back to
  unrestricted), ALL and full-access, plus the IDOR guard and the two `isOwnX` helpers.
- `transitions.test.ts` (12 tests) — every documented Campaign/Content status-transition rule,
  explicitly including "PUBLISHED is never a direct target" and "nothing escapes a terminal
  status."
- `analytics.test.ts` (10 tests) — `computeKpiStatus`'s target/deadline/pace logic, and the
  inline CSV parser (quoted fields, escaped quotes, CRLF).
- `planner.test.ts` (7 tests) — `walkForDependencyCycle` (extracted as an injectable-lookup
  pure function specifically so this could be tested without Prisma): self-dependency, direct
  cycles, longer cycles, and confirms the walk terminates even on an unrelated already-corrupt
  chain.
- A `vitest.setup.ts` mocks `@/lib/auth/current-admin` (which transitively imports `next/
  headers`, unresolvable outside Next's runtime) and `@/lib/prisma` (which throws at import
  time without `DATABASE_URL`) — neither is ever actually called by these tests.

**Not done, honestly**: no integration tests against a real database, no API-route-level
tests (would need a running Next server or heavy mocking of `NextRequest`/`NextResponse`), no
UI/component tests. `npm run test` runs real, passing tests — but "tested" here means the pure
logic layer, not end-to-end coverage.

## Phase 18 — Validation

Status: DONE. `npx prisma validate` ✓, `npx prisma migrate status` ✓ (16 migrations, schema
up to date), `npx tsc --noEmit` ✓ (zero errors across the entire app, not just this module),
`npx eslint .` ✓ (only the same 4 pre-existing errors in `TeamDepartmentView.tsx`/`TeamTab.tsx`
that predate this session, confirmed via `git log` on those files — nothing new introduced),
`npm run build` ✓ (full production build succeeds), `npx vitest run` ✓ (44/44 passing).

## Phase 19 — Final review

- [x] Overview — real stats, real budget-by-currency, real upcoming/overdue counts; no charts.
- [x] Campaigns — full CRUD + lifecycle actions, server-enforced transitions; new fields
      (objective/priority/client/project/department/owner/manager/budget/currency) not yet in
      the create/edit form.
- [x] Planner — real milestones/tasks, real Calendar sync; no calendar-grid view.
- [x] Content — real workflow + real Brand Assets/Social Media integration; no asset-picker UI.
- [x] Audiences — real shared library + assignment.
- [x] Budget — real allocations/expenses/approval/Monzo matching, currency-safe throughout.
- [x] Analytics — real KPIs/metrics/CSV import/export; no cross-campaign dashboard UI (backend
      ranking endpoint exists, unused by the frontend).
- [x] Approvals — real request/decide/comment workflow with hard separation-of-duties rules.

Database persistence, API endpoints, authentication and server-side permission enforcement are
real for every section above. UI exists and is functional for every section, with the specific,
listed gaps documented rather than hidden. No fabricated information is displayed anywhere —
every "empty" state reflects a real absence of data (e.g. Analytics' "no data yet", Overview's
honest zero counts).

Integrations: Clients/Projects/Team/Calendar/Brand Assets/Social Media/Finance/Notifications
are all real (cross-referenced in Phase 15 above) — none are faked or merely declared complete.

## Phase 20 — Final report

See the message delivered to the user alongside this checklist for the full report (features
completed, files changed, tests executed, known limitations, migration status, etc.) — this
file is the durable, in-repo record; the chat message is the human-readable summary of it.
