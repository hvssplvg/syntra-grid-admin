/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileClock,
  Filter,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Unlock,
  X,
  XCircle,
} from "lucide-react";

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type Viewer = {
  adminId: string;
  employeeId: string;
  role: string;
  isTimesheetManager: boolean;
};

type DepartmentOption = {
  id: string;
  name: string;
  slug?: string | null;
  code?: string | null;
  colour?: string | null;
};

type EmployeeOption = {
  id: string;
  employeeRef: string | null;

  firstName: string;
  lastName: string;
  preferredName: string | null;

  name: string;

  avatarUrl: string | null;
  jobTitle: string;

  status: string;
  employmentType: string;

  departmentId: string | null;

  department: {
    id: string;
    name: string;
    colour: string | null;
  } | null;
};

type ClientOption = {
  id: string;
  name: string;
  displayName: string | null;
  clientRef?: string | null;
  logoUrl?: string | null;
  status?: string;
  priority?: string;
};

type ProjectOption = {
  id: string;
  clientId: string;

  name: string;
  slug?: string;

  category?: string;
  status?: string;

  client: {
    id: string;
    name: string;
    displayName: string | null;
  };
};

type AllocationOption = {
  id: string;

  employeeId: string;

  employee: {
    id: string;
    name: string;
  };

  departmentId: string | null;
  clientId: string | null;
  projectId: string | null;

  title: string;
  description: string | null;

  type: string;
  status: string;
  priority: string;

  startDate: string;
  endDate: string;

  allocationMode: string;

  hoursPerWeek: number | null;
  allocationPercent: number | null;
  budgetHours: number | null;

  billable: boolean;

  client: {
    id: string;
    name: string;
    displayName: string | null;
  } | null;

  project: {
    id: string;
    name: string;
    clientId: string;
  } | null;
};

type TimesheetOptionsResponse = {
  viewer: Viewer;

  employees: EmployeeOption[];
  departments: DepartmentOption[];

  clients: ClientOption[];
  projects: ProjectOption[];

  allocations: AllocationOption[];

  enums: {
    statuses: string[];
    entryTypes: string[];
  };
};

type TimesheetEntry = {
  id: string;

  timesheetId: string;
  employeeId: string;

  clientId: string | null;
  projectId: string | null;
  allocationId: string | null;

  workDate: string;

  type: string;

  title: string;
  description: string | null;

  hours: number;

  billable: boolean;

  startedAt: string | null;
  endedAt: string | null;

  invoiceId: string | null;
  billedAt: string | null;

  notes: string | null;

  client: {
    id: string;
    name: string;
    displayName: string | null;
  } | null;

  project: {
    id: string;
    name: string;
    clientId: string;
  } | null;

  allocation: {
    id: string;
    title: string;
    clientId: string | null;
    projectId: string | null;
    billable: boolean;
  } | null;

  invoiced: boolean;

  createdAt: string;
  updatedAt: string;
};

type TimesheetActivity = {
  id: string;

  type: string;
  description: string | null;

  metadata: unknown;

  createdAt: string;

  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type TimesheetPermissions = {
  canEdit: boolean;
  canSubmit: boolean;

  canReview: boolean;
  canApprove: boolean;
  canReject: boolean;

  canReopen: boolean;

  canLock: boolean;
  canUnlock: boolean;

  canDelete: boolean;
};

type Timesheet = {
  id: string;

  timesheetRef: string | null;

  employeeId: string;
  employee: EmployeeOption;

  status: string;

  periodStart: string;
  periodEnd: string;

  totalHours: number;
  billableHours: number;
  nonBillableHours: number;

  expectedHours: number | null;
  remainingHours: number | null;

  utilisationPercent: number | null;
  billablePercent: number;

  employeeNote: string | null;

  reviewedBy: {
    id: string;
    name: string;
    email: string;
  } | null;

  reviewedAt: string | null;

  reviewNote: string | null;
  rejectionReason: string | null;

  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;

  lockedAt: string | null;

  lockedBy: {
    id: string;
    name: string;
    email: string;
  } | null;

  entryCount: number;

  entries: TimesheetEntry[];
  activities: TimesheetActivity[];

  permissions: TimesheetPermissions;

  createdAt: string;
  updatedAt: string;
};

type TimesheetSummary = {
  timesheetCount: number;
  employeeCount: number;

  expectedHours: number;
  recordedHours: number;

  billableHours: number;
  nonBillableHours: number;

  remainingHours: number;

  utilisationPercent: number;
  billablePercent: number;

  draftCount: number;
  submittedCount: number;
  approvedCount: number;
  rejectedCount: number;
  lockedCount: number;
};

type TimesheetFeedResponse = {
  viewer: Viewer;

  range: {
    start: string;
    end: string;
  };

  filters: {
    employeeId: string | null;
    departmentId: string | null;
    clientId: string | null;
    projectId: string | null;
    status: string | null;
  };

  summary: TimesheetSummary;

  timesheets: Timesheet[];
};

type EntryForm = {
  workDate: string;

  type: string;

  allocationId: string;
  clientId: string;
  projectId: string;

  title: string;
  description: string;

  hours: string;

  billable: boolean;

  startedAt: string;
  endedAt: string;

  notes: string;
};

type CreateTimesheetForm = {
  employeeId: string;
  employeeNote: string;
};

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const EMPTY_ENTRY_FORM: EntryForm = {
  workDate: "",

  type: "PROJECT",

  allocationId: "",
  clientId: "",
  projectId: "",

  title: "",
  description: "",

  hours: "",

  billable: false,

  startedAt: "",
  endedAt: "",

  notes: "",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  LOCKED: "Locked",
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  PROJECT: "Project",
  CLIENT_SUPPORT: "Client support",
  MAINTENANCE: "Maintenance",
  MEETING: "Meeting",
  INTERNAL: "Internal",
  PRODUCT: "Product",
  SALES: "Sales",
  RECRUITMENT: "Recruitment",
  TRAINING: "Training",
  ADMIN: "Admin",
  TRAVEL: "Travel",
  OTHER: "Other",
};

/* =============================================================================
 * COMPONENT
 * =============================================================================
 */

export default function TimesheetsTab() {
  const initialWeek =
    useMemo(
      () =>
        getWeekRange(
          new Date(),
        ),
      [],
    );

  const [
    weekStart,
    setWeekStart,
  ] = useState(
    initialWeek.start,
  );

  const [
    options,
    setOptions,
  ] =
    useState<TimesheetOptionsResponse | null>(
      null,
    );

  const [
    feed,
    setFeed,
  ] =
    useState<TimesheetFeedResponse | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    employeeFilter,
    setEmployeeFilter,
  ] = useState("");

  const [
    departmentFilter,
    setDepartmentFilter,
  ] = useState("");

  const [
    clientFilter,
    setClientFilter,
  ] = useState("");

  const [
    projectFilter,
    setProjectFilter,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("");

  const [
    expanded,
    setExpanded,
  ] =
    useState<Set<string>>(
      new Set(),
    );

  const [
    createOpen,
    setCreateOpen,
  ] = useState(false);

  const [
    createForm,
    setCreateForm,
  ] =
    useState<CreateTimesheetForm>({
      employeeId: "",
      employeeNote: "",
    });

  const [
    entryOpen,
    setEntryOpen,
  ] = useState(false);

  const [
    activeTimesheet,
    setActiveTimesheet,
  ] =
    useState<Timesheet | null>(
      null,
    );

  const [
    editingEntry,
    setEditingEntry,
  ] =
    useState<TimesheetEntry | null>(
      null,
    );

  const [
    entryForm,
    setEntryForm,
  ] =
    useState<EntryForm>(
      EMPTY_ENTRY_FORM,
    );

  const [
    actionTimesheet,
    setActionTimesheet,
  ] =
    useState<Timesheet | null>(
      null,
    );

  const [
    actionMode,
    setActionMode,
  ] =
    useState<
      | "approve"
      | "reject"
      | "reopen"
      | "unlock"
      | null
    >(null);

  const [
    actionNote,
    setActionNote,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const weekEnd =
    useMemo(
      () =>
        addDays(
          weekStart,
          7,
        ),
      [weekStart],
    );

  const loadOptions =
    useCallback(async () => {
      const data =
        await apiJson<TimesheetOptionsResponse>(
          "/api/admin/timesheets/options",
        );

      setOptions(data);
    }, []);

  const loadFeed =
    useCallback(
      async (
        quiet = false,
      ) => {
        if (!quiet) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError(null);

        try {
          const params =
            new URLSearchParams();

          params.set(
            "start",
            dateInput(
              weekStart,
            ),
          );

          params.set(
            "end",
            dateInput(
              weekEnd,
            ),
          );

          if (employeeFilter) {
            params.set(
              "employeeId",
              employeeFilter,
            );
          }

          if (departmentFilter) {
            params.set(
              "departmentId",
              departmentFilter,
            );
          }

          if (clientFilter) {
            params.set(
              "clientId",
              clientFilter,
            );
          }

          if (projectFilter) {
            params.set(
              "projectId",
              projectFilter,
            );
          }

          if (statusFilter) {
            params.set(
              "status",
              statusFilter,
            );
          }

          const data =
            await apiJson<TimesheetFeedResponse>(
              `/api/admin/timesheets?${params.toString()}`,
            );

          setFeed(data);
        } catch (cause) {
          setError(
            errorMessage(
              cause,
            ),
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        weekStart,
        weekEnd,
        employeeFilter,
        departmentFilter,
        clientFilter,
        projectFilter,
        statusFilter,
      ],
    );

  useEffect(() => {
    loadOptions().catch(
      (cause) => {
        setError(
          errorMessage(
            cause,
          ),
        );
      },
    );
  }, [loadOptions]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const viewer =
    feed?.viewer ||
    options?.viewer ||
    null;

  const summary =
    feed?.summary;

  const visibleProjects =
    useMemo(() => {
      if (!options) {
        return [];
      }

      if (!clientFilter) {
        return options.projects;
      }

      return options.projects.filter(
        (project) =>
          project.clientId ===
          clientFilter,
      );
    }, [
      options,
      clientFilter,
    ]);

  function previousWeek() {
    setWeekStart(
      (current) =>
        addDays(
          current,
          -7,
        ),
    );
  }

  function nextWeek() {
    setWeekStart(
      (current) =>
        addDays(
          current,
          7,
        ),
    );
  }

  function thisWeek() {
    setWeekStart(
      getWeekRange(
        new Date(),
      ).start,
    );
  }

  function toggleExpanded(
    id: string,
  ) {
    setExpanded(
      (current) => {
        const next =
          new Set(
            current,
          );

        if (
          next.has(id)
        ) {
          next.delete(id);
        } else {
          next.add(id);
        }

        return next;
      },
    );
  }

  function openCreateTimesheet() {
    const defaultEmployee =
      viewer?.isTimesheetManager
        ? employeeFilter ||
          options?.employees[0]
            ?.id ||
          ""
        : viewer?.employeeId ||
          "";

    setCreateForm({
      employeeId:
        defaultEmployee,

      employeeNote:
        "",
    });

    setCreateOpen(true);
  }

  async function submitCreateTimesheet(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (
      !createForm.employeeId
    ) {
      setError(
        "Choose an employee.",
      );

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const periodEnd =
        addDays(
          weekStart,
          6,
        );

      const result =
        await apiJson<{
          timesheet: Timesheet;
        }>(
          "/api/admin/timesheets",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              employeeId:
                createForm.employeeId,

              periodStart:
                dateInput(
                  weekStart,
                ),

              periodEnd:
                dateInput(
                  periodEnd,
                ),

              employeeNote:
                createForm.employeeNote ||
                null,
            }),
          },
        );

      setCreateOpen(false);

      setExpanded(
        (current) =>
          new Set([
            ...current,
            result.timesheet.id,
          ]),
      );

      await loadFeed(true);
    } catch (cause) {
      setError(
        errorMessage(
          cause,
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  function openAddEntry(
    timesheet: Timesheet,
    date?: string,
  ) {
    setActiveTimesheet(
      timesheet,
    );

    setEditingEntry(null);

    setEntryForm({
      ...EMPTY_ENTRY_FORM,

      workDate:
        date ||
        dateInput(
          new Date(
            timesheet.periodStart,
          ),
        ),
    });

    setEntryOpen(true);
  }

  function openEditEntry(
    timesheet: Timesheet,
    entry: TimesheetEntry,
  ) {
    setActiveTimesheet(
      timesheet,
    );

    setEditingEntry(
      entry,
    );

    setEntryForm({
      workDate:
        dateInput(
          new Date(
            entry.workDate,
          ),
        ),

      type:
        entry.type,

      allocationId:
        entry.allocationId ||
        "",

      clientId:
        entry.clientId ||
        "",

      projectId:
        entry.projectId ||
        "",

      title:
        entry.title,

      description:
        entry.description ||
        "",

      hours:
        String(
          entry.hours,
        ),

      billable:
        entry.billable,

      startedAt:
        datetimeLocal(
          entry.startedAt,
        ),

      endedAt:
        datetimeLocal(
          entry.endedAt,
        ),

      notes:
        entry.notes ||
        "",
    });

    setEntryOpen(true);
  }

  function selectAllocation(
    allocationId: string,
  ) {
    const allocation =
      options?.allocations.find(
        (item) =>
          item.id ===
          allocationId,
      );

    if (!allocation) {
      setEntryForm(
        (current) => ({
          ...current,

          allocationId:
            "",

          clientId:
            "",

          projectId:
            "",
        }),
      );

      return;
    }

    setEntryForm(
      (current) => ({
        ...current,

        allocationId:
          allocation.id,

        clientId:
          allocation.clientId ||
          "",

        projectId:
          allocation.projectId ||
          "",

        title:
          current.title ||
          allocation.title,

        billable:
          allocation.billable,
      }),
    );
  }

  async function saveEntry(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (
      !activeTimesheet
    ) {
      return;
    }

    if (
      !entryForm.workDate
    ) {
      setError(
        "Choose a work date.",
      );

      return;
    }

    if (
      !entryForm.title.trim()
    ) {
      setError(
        "Enter a title for the time entry.",
      );

      return;
    }

    const hours =
      Number(
        entryForm.hours,
      );

    if (
      !Number.isFinite(
        hours,
      ) ||
      hours <= 0
    ) {
      setError(
        "Enter valid hours.",
      );

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        workDate:
          entryForm.workDate,

        type:
          entryForm.type,

        allocationId:
          entryForm.allocationId ||
          null,

        clientId:
          entryForm.clientId ||
          null,

        projectId:
          entryForm.projectId ||
          null,

        title:
          entryForm.title.trim(),

        description:
          entryForm.description.trim() ||
          null,

        hours,

        billable:
          entryForm.billable,

        startedAt:
          entryForm.startedAt
            ? new Date(
                entryForm.startedAt,
              ).toISOString()
            : null,

        endedAt:
          entryForm.endedAt
            ? new Date(
                entryForm.endedAt,
              ).toISOString()
            : null,

        notes:
          entryForm.notes.trim() ||
          null,
      };

      const url =
        editingEntry
          ? `/api/admin/timesheets/${activeTimesheet.id}/entries/${editingEntry.id}`
          : `/api/admin/timesheets/${activeTimesheet.id}/entries`;

      await apiJson(
        url,
        {
          method:
            editingEntry
              ? "PATCH"
              : "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              payload,
            ),
        },
      );

      setEntryOpen(false);

      setEditingEntry(
        null,
      );

      setActiveTimesheet(
        null,
      );

      await loadFeed(true);
    } catch (cause) {
      setError(
        errorMessage(
          cause,
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(
    timesheet: Timesheet,
    entry: TimesheetEntry,
  ) {
    if (
      !window.confirm(
        `Remove "${entry.title}" from this timesheet?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiJson(
        `/api/admin/timesheets/${timesheet.id}/entries/${entry.id}`,
        {
          method:
            "DELETE",
        },
      );

      await loadFeed(true);
    } catch (cause) {
      setError(
        errorMessage(
          cause,
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitTimesheet(
    timesheet: Timesheet,
  ) {
    if (
      !window.confirm(
        `Submit ${timesheet.employee.name}'s timesheet for approval?`,
      )
    ) {
      return;
    }

    await runWorkflow(
      timesheet,
      "submit",
    );
  }

  async function lockTimesheet(
    timesheet: Timesheet,
  ) {
    if (
      !window.confirm(
        "Lock this approved timesheet? It will be treated as finalised.",
      )
    ) {
      return;
    }

    await runWorkflow(
      timesheet,
      "lock",
    );
  }

  function openAction(
    timesheet: Timesheet,
    mode:
      | "approve"
      | "reject"
      | "reopen"
      | "unlock",
  ) {
    setActionTimesheet(
      timesheet,
    );

    setActionMode(mode);
    setActionNote("");

    setError(null);
  }

  async function submitAction(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (
      !actionTimesheet ||
      !actionMode
    ) {
      return;
    }

    if (
      actionMode ===
        "reject" &&
      !actionNote.trim()
    ) {
      setError(
        "Enter a rejection reason.",
      );

      return;
    }

    const body =
      actionMode ===
      "approve"
        ? {
            reviewNote:
              actionNote.trim() ||
              null,
          }
        : actionMode ===
            "reject"
          ? {
              rejectionReason:
                actionNote.trim(),
            }
          : {
              note:
                actionNote.trim() ||
                null,
            };

    await runWorkflow(
      actionTimesheet,
      actionMode,
      body,
    );

    setActionMode(null);
    setActionTimesheet(null);
    setActionNote("");
  }

  async function runWorkflow(
    timesheet: Timesheet,
    action: string,
    body?: unknown,
  ) {
    setSaving(true);
    setError(null);

    try {
      await apiJson(
        `/api/admin/timesheets/${timesheet.id}/${action}`,
        {
          method:
            "POST",

          ...(body !==
          undefined
            ? {
                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify(
                    body,
                  ),
              }
            : {}),
        },
      );

      await loadFeed(true);
    } catch (cause) {
      setError(
        errorMessage(
          cause,
        ),
      );

      throw cause;
    } finally {
      setSaving(false);
    }
  }

  async function deleteTimesheet(
    timesheet: Timesheet,
  ) {
    if (
      !window.confirm(
        `Delete ${timesheet.employee.name}'s draft timesheet?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiJson(
        `/api/admin/timesheets/${timesheet.id}`,
        {
          method:
            "DELETE",
        },
      );

      await loadFeed(true);
    } catch (cause) {
      setError(
        errorMessage(
          cause,
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f8fa]">
      <div className="mx-auto w-full max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8">
        {/* ================================================================
            HEADER
        ================================================================= */}

        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              <FileClock size={14} />
              Company
            </div>

            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-zinc-950 sm:text-[30px]">
              Timesheets
            </h1>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
              Record actual work,
              compare expected hours,
              track billable time and
              manage weekly approvals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                void loadFeed(
                  true,
                )
              }
              disabled={
                refreshing
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={
                openCreateTimesheet
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            >
              <Plus size={16} />
              New timesheet
            </button>
          </div>
        </div>

        {/* ================================================================
            ERROR
        ================================================================= */}

        {error ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="min-w-0 flex-1">
              {error}
            </div>

            <button
              type="button"
              onClick={() =>
                setError(null)
              }
              className="text-red-500 hover:text-red-800"
            >
              <X size={17} />
            </button>
          </div>
        ) : null}

        {/* ================================================================
            WEEK NAVIGATION
        ================================================================= */}

        <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={
                  previousWeek
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
              >
                <ArrowLeft
                  size={16}
                />
              </button>

              <div className="flex min-w-[230px] items-center justify-center gap-2 rounded-xl bg-zinc-50 px-4 py-2">
                <CalendarDays
                  size={16}
                  className="text-zinc-500"
                />

                <span className="text-sm font-semibold text-zinc-900">
                  {formatWeekRange(
                    weekStart,
                    addDays(
                      weekStart,
                      6,
                    ),
                  )}
                </span>
              </div>

              <button
                type="button"
                onClick={
                  nextWeek
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
              >
                <ArrowRight
                  size={16}
                />
              </button>

              <button
                type="button"
                onClick={
                  thisWeek
                }
                className="ml-1 h-9 rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50"
              >
                This week
              </button>
            </div>

            <div className="text-xs text-zinc-400">
              Week runs Monday
              through Sunday
            </div>
          </div>
        </section>

        {/* ================================================================
            SUMMARY
        ================================================================= */}

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <MetricCard
            label="Expected"
            value={`${formatHours(summary?.expectedHours)}h`}
            detail={`${summary?.employeeCount ?? 0} employees`}
            icon={
              <Clock3
                size={17}
              />
            }
          />

          <MetricCard
            label="Recorded"
            value={`${formatHours(summary?.recordedHours)}h`}
            detail={`${formatPercent(summary?.utilisationPercent)} utilisation`}
            icon={
              <FileClock
                size={17}
              />
            }
          />

          <MetricCard
            label="Billable"
            value={`${formatHours(summary?.billableHours)}h`}
            detail={`${formatPercent(summary?.billablePercent)} of recorded`}
            icon={
              <CircleDollarSign
                size={17}
              />
            }
          />

          <MetricCard
            label="Non-billable"
            value={`${formatHours(summary?.nonBillableHours)}h`}
            detail="Internal time"
            icon={
              <BriefcaseBusiness
                size={17}
              />
            }
          />

          <MetricCard
            label="Remaining"
            value={`${formatHours(summary?.remainingHours)}h`}
            detail="Expected vs actual"
            icon={
              <CalendarDays
                size={17}
              />
            }
          />

          <MetricCard
            label="Awaiting review"
            value={String(
              summary?.submittedCount ??
                0,
            )}
            detail={`${summary?.approvedCount ?? 0} approved`}
            icon={
              <CheckCircle2
                size={17}
              />
            }
          />
        </div>

        {/* ================================================================
            STATUS STRIP
        ================================================================= */}

        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatusCount
            label="Draft"
            count={
              summary?.draftCount ??
              0
            }
            status="DRAFT"
          />

          <StatusCount
            label="Submitted"
            count={
              summary?.submittedCount ??
              0
            }
            status="SUBMITTED"
          />

          <StatusCount
            label="Approved"
            count={
              summary?.approvedCount ??
              0
            }
            status="APPROVED"
          />

          <StatusCount
            label="Rejected"
            count={
              summary?.rejectedCount ??
              0
            }
            status="REJECTED"
          />

          <StatusCount
            label="Locked"
            count={
              summary?.lockedCount ??
              0
            }
            status="LOCKED"
          />
        </div>

        {/* ================================================================
            FILTERS
        ================================================================= */}

        <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 px-1">
            <Filter
              size={15}
              className="text-zinc-400"
            />

            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
              Filters
            </span>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <SelectField
              value={
                employeeFilter
              }
              onChange={
                setEmployeeFilter
              }
              placeholder="All employees"
              disabled={
                !viewer?.isTimesheetManager
              }
              options={
                options?.employees.map(
                  (employee) => ({
                    value:
                      employee.id,
                    label:
                      employee.name,
                  }),
                ) || []
              }
            />

            <SelectField
              value={
                departmentFilter
              }
              onChange={
                setDepartmentFilter
              }
              placeholder="All departments"
              disabled={
                !viewer?.isTimesheetManager
              }
              options={
                options?.departments.map(
                  (department) => ({
                    value:
                      department.id,
                    label:
                      department.name,
                  }),
                ) || []
              }
            />

            <SelectField
              value={
                clientFilter
              }
              onChange={(value) => {
                setClientFilter(
                  value,
                );

                if (
                  projectFilter
                ) {
                  const project =
                    options?.projects.find(
                      (item) =>
                        item.id ===
                        projectFilter,
                    );

                  if (
                    value &&
                    project &&
                    project.clientId !==
                      value
                  ) {
                    setProjectFilter(
                      "",
                    );
                  }
                }
              }}
              placeholder="All clients"
              options={
                options?.clients.map(
                  (client) => ({
                    value:
                      client.id,
                    label:
                      client.displayName ||
                      client.name,
                  }),
                ) || []
              }
            />

            <SelectField
              value={
                projectFilter
              }
              onChange={
                setProjectFilter
              }
              placeholder="All projects"
              options={visibleProjects.map(
                (project) => ({
                  value:
                    project.id,
                  label:
                    project.name,
                }),
              )}
            />

            <SelectField
              value={
                statusFilter
              }
              onChange={
                setStatusFilter
              }
              placeholder="All statuses"
              options={
                options?.enums.statuses.map(
                  (status) => ({
                    value:
                      status,
                    label:
                      STATUS_LABELS[
                        status
                      ] ||
                      humanise(
                        status,
                      ),
                  }),
                ) || []
              }
            />
          </div>
        </section>

        {/* ================================================================
            CONTENT
        ================================================================= */}

        {loading ? (
          <LoadingState />
        ) : !feed?.timesheets
            .length ? (
          <EmptyState
            canCreate={
              Boolean(viewer)
            }
            onCreate={
              openCreateTimesheet
            }
          />
        ) : (
          <div className="space-y-3">
            {feed.timesheets.map(
              (timesheet) => (
                <TimesheetCard
                  key={
                    timesheet.id
                  }
                  timesheet={
                    timesheet
                  }
                  expanded={expanded.has(
                    timesheet.id,
                  )}
                  saving={
                    saving
                  }
                  onToggle={() =>
                    toggleExpanded(
                      timesheet.id,
                    )
                  }
                  onAddEntry={(
                    date,
                  ) =>
                    openAddEntry(
                      timesheet,
                      date,
                    )
                  }
                  onEditEntry={(
                    entry,
                  ) =>
                    openEditEntry(
                      timesheet,
                      entry,
                    )
                  }
                  onDeleteEntry={(
                    entry,
                  ) =>
                    void deleteEntry(
                      timesheet,
                      entry,
                    )
                  }
                  onSubmit={() =>
                    void submitTimesheet(
                      timesheet,
                    )
                  }
                  onApprove={() =>
                    openAction(
                      timesheet,
                      "approve",
                    )
                  }
                  onReject={() =>
                    openAction(
                      timesheet,
                      "reject",
                    )
                  }
                  onReopen={() =>
                    openAction(
                      timesheet,
                      "reopen",
                    )
                  }
                  onLock={() =>
                    void lockTimesheet(
                      timesheet,
                    )
                  }
                  onUnlock={() =>
                    openAction(
                      timesheet,
                      "unlock",
                    )
                  }
                  onDelete={() =>
                    void deleteTimesheet(
                      timesheet,
                    )
                  }
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* =================================================================
          CREATE TIMESHEET MODAL
      ================================================================== */}

      {createOpen ? (
        <Modal
          title="New timesheet"
          subtitle={`Create a timesheet for ${formatWeekRange(
            weekStart,
            addDays(
              weekStart,
              6,
            ),
          )}.`}
          onClose={() =>
            !saving &&
            setCreateOpen(
              false,
            )
          }
        >
          <form
            onSubmit={
              submitCreateTimesheet
            }
            className="space-y-4"
          >
            <Field
              label="Employee"
              required
            >
              <select
                value={
                  createForm.employeeId
                }
                onChange={(
                  event,
                ) =>
                  setCreateForm(
                    (current) => ({
                      ...current,

                      employeeId:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                disabled={
                  !viewer?.isTimesheetManager
                }
                className={inputClass}
              >
                <option value="">
                  Select employee
                </option>

                {options?.employees.map(
                  (employee) => (
                    <option
                      key={
                        employee.id
                      }
                      value={
                        employee.id
                      }
                    >
                      {
                        employee.name
                      }
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field label="Employee note">
              <textarea
                value={
                  createForm.employeeNote
                }
                onChange={(
                  event,
                ) =>
                  setCreateForm(
                    (current) => ({
                      ...current,

                      employeeNote:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                rows={4}
                placeholder="Optional note for this week..."
                className={`${inputClass} min-h-[100px] resize-y py-3`}
              />
            </Field>

            <ModalActions
              saving={
                saving
              }
              primaryLabel="Create timesheet"
              onCancel={() =>
                setCreateOpen(
                  false,
                )
              }
            />
          </form>
        </Modal>
      ) : null}

      {/* =================================================================
          ENTRY MODAL
      ================================================================== */}

      {entryOpen &&
      activeTimesheet ? (
        <Modal
          title={
            editingEntry
              ? "Edit time entry"
              : "Add time entry"
          }
          subtitle={`${activeTimesheet.employee.name} • ${formatWeekRange(
            new Date(
              activeTimesheet.periodStart,
            ),
            new Date(
              activeTimesheet.periodEnd,
            ),
          )}`}
          onClose={() => {
            if (saving) {
              return;
            }

            setEntryOpen(
              false,
            );

            setEditingEntry(
              null,
            );

            setActiveTimesheet(
              null,
            );
          }}
          wide
        >
          <form
            onSubmit={
              saveEntry
            }
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Work date"
                required
              >
                <input
                  type="date"
                  value={
                    entryForm.workDate
                  }
                  min={dateInput(
                    new Date(
                      activeTimesheet.periodStart,
                    ),
                  )}
                  max={dateInput(
                    new Date(
                      activeTimesheet.periodEnd,
                    ),
                  )}
                  onChange={(
                    event,
                  ) =>
                    updateEntryForm(
                      setEntryForm,
                      "workDate",
                      event.target
                        .value,
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field
                label="Entry type"
                required
              >
                <select
                  value={
                    entryForm.type
                  }
                  onChange={(
                    event,
                  ) =>
                    updateEntryForm(
                      setEntryForm,
                      "type",
                      event.target
                        .value,
                    )
                  }
                  className={
                    inputClass
                  }
                >
                  {options?.enums.entryTypes.map(
                    (type) => (
                      <option
                        key={
                          type
                        }
                        value={
                          type
                        }
                      >
                        {ENTRY_TYPE_LABELS[
                          type
                        ] ||
                          humanise(
                            type,
                          )}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            </div>

            <Field label="Workload allocation">
              <select
                value={
                  entryForm.allocationId
                }
                onChange={(
                  event,
                ) =>
                  selectAllocation(
                    event.target
                      .value,
                  )
                }
                className={
                  inputClass
                }
              >
                <option value="">
                  No linked allocation
                </option>

                {options?.allocations
                  .filter(
                    (allocation) =>
                      allocation.employeeId ===
                      activeTimesheet.employeeId,
                  )
                  .map(
                    (
                      allocation,
                    ) => (
                      <option
                        key={
                          allocation.id
                        }
                        value={
                          allocation.id
                        }
                      >
                        {
                          allocation.title
                        }
                        {allocation.project
                          ? ` — ${allocation.project.name}`
                          : allocation.client
                            ? ` — ${
                                allocation
                                  .client
                                  .displayName ||
                                allocation
                                  .client
                                  .name
                              }`
                            : ""}
                      </option>
                    ),
                  )}
              </select>

              <p className="mt-1.5 text-xs leading-5 text-zinc-400">
                Linking an
                allocation lets
                Workload compare
                planned hours with
                actual time.
              </p>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client">
                <select
                  value={
                    entryForm.clientId
                  }
                  onChange={(
                    event,
                  ) => {
                    const value =
                      event.target
                        .value;

                    setEntryForm(
                      (current) => ({
                        ...current,

                        clientId:
                          value,

                        projectId:
                          current.projectId &&
                          options?.projects.find(
                            (
                              project,
                            ) =>
                              project.id ===
                              current.projectId &&
                              project.clientId ===
                                value,
                          )
                            ? current.projectId
                            : "",
                      }),
                    );
                  }}
                  className={
                    inputClass
                  }
                >
                  <option value="">
                    No client
                  </option>

                  {options?.clients.map(
                    (client) => (
                      <option
                        key={
                          client.id
                        }
                        value={
                          client.id
                        }
                      >
                        {client.displayName ||
                          client.name}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Project">
                <select
                  value={
                    entryForm.projectId
                  }
                  onChange={(
                    event,
                  ) => {
                    const project =
                      options?.projects.find(
                        (item) =>
                          item.id ===
                          event
                            .target
                            .value,
                      );

                    setEntryForm(
                      (current) => ({
                        ...current,

                        projectId:
                          event
                            .target
                            .value,

                        clientId:
                          project?.clientId ||
                          current.clientId,
                      }),
                    );
                  }}
                  className={
                    inputClass
                  }
                >
                  <option value="">
                    No project
                  </option>

                  {options?.projects
                    .filter(
                      (project) =>
                        !entryForm.clientId ||
                        project.clientId ===
                          entryForm.clientId,
                    )
                    .map(
                      (
                        project,
                      ) => (
                        <option
                          key={
                            project.id
                          }
                          value={
                            project.id
                          }
                        >
                          {
                            project.name
                          }
                        </option>
                      ),
                    )}
                </select>
              </Field>
            </div>

            <Field
              label="Title"
              required
            >
              <input
                value={
                  entryForm.title
                }
                onChange={(
                  event,
                ) =>
                  updateEntryForm(
                    setEntryForm,
                    "title",
                    event.target
                      .value,
                  )
                }
                placeholder="e.g. Estate management dashboard"
                className={
                  inputClass
                }
              />
            </Field>

            <Field label="Description">
              <textarea
                value={
                  entryForm.description
                }
                onChange={(
                  event,
                ) =>
                  updateEntryForm(
                    setEntryForm,
                    "description",
                    event.target
                      .value,
                  )
                }
                rows={3}
                placeholder="What was worked on?"
                className={`${inputClass} min-h-[88px] resize-y py-3`}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Hours"
                required
              >
                <input
                  type="number"
                  min="0.01"
                  max="24"
                  step="0.25"
                  value={
                    entryForm.hours
                  }
                  onChange={(
                    event,
                  ) =>
                    updateEntryForm(
                      setEntryForm,
                      "hours",
                      event.target
                        .value,
                    )
                  }
                  placeholder="0.00"
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field label="Started at">
                <input
                  type="datetime-local"
                  value={
                    entryForm.startedAt
                  }
                  onChange={(
                    event,
                  ) =>
                    updateEntryForm(
                      setEntryForm,
                      "startedAt",
                      event.target
                        .value,
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field label="Ended at">
                <input
                  type="datetime-local"
                  value={
                    entryForm.endedAt
                  }
                  onChange={(
                    event,
                  ) =>
                    updateEntryForm(
                      setEntryForm,
                      "endedAt",
                      event.target
                        .value,
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </Field>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  Billable time
                </div>

                <div className="mt-0.5 text-xs text-zinc-500">
                  Include these
                  hours in client
                  billable time.
                </div>
              </div>

              <input
                type="checkbox"
                checked={
                  entryForm.billable
                }
                onChange={(
                  event,
                ) =>
                  setEntryForm(
                    (current) => ({
                      ...current,

                      billable:
                        event
                          .target
                          .checked,
                    }),
                  )
                }
                className="h-4 w-4 rounded border-zinc-300"
              />
            </label>

            <Field label="Internal notes">
              <textarea
                value={
                  entryForm.notes
                }
                onChange={(
                  event,
                ) =>
                  updateEntryForm(
                    setEntryForm,
                    "notes",
                    event.target
                      .value,
                  )
                }
                rows={2}
                className={`${inputClass} resize-y py-3`}
              />
            </Field>

            <ModalActions
              saving={
                saving
              }
              primaryLabel={
                editingEntry
                  ? "Save changes"
                  : "Add time"
              }
              onCancel={() =>
                setEntryOpen(
                  false,
                )
              }
            />
          </form>
        </Modal>
      ) : null}

      {/* =================================================================
          WORKFLOW MODAL
      ================================================================== */}

      {actionMode &&
      actionTimesheet ? (
        <Modal
          title={
            actionMode ===
            "approve"
              ? "Approve timesheet"
              : actionMode ===
                  "reject"
                ? "Reject timesheet"
                : actionMode ===
                    "reopen"
                  ? "Reopen timesheet"
                  : "Unlock timesheet"
          }
          subtitle={`${actionTimesheet.employee.name} • ${formatHours(
            actionTimesheet.totalHours,
          )}h recorded`}
          onClose={() => {
            if (saving) {
              return;
            }

            setActionMode(
              null,
            );

            setActionTimesheet(
              null,
            );
          }}
        >
          <form
            onSubmit={
              submitAction
            }
            className="space-y-4"
          >
            <Field
              label={
                actionMode ===
                "reject"
                  ? "Rejection reason"
                  : actionMode ===
                      "approve"
                    ? "Review note"
                    : "Note"
              }
              required={
                actionMode ===
                "reject"
              }
            >
              <textarea
                value={
                  actionNote
                }
                onChange={(
                  event,
                ) =>
                  setActionNote(
                    event.target
                      .value,
                  )
                }
                rows={4}
                placeholder={
                  actionMode ===
                  "reject"
                    ? "Explain what needs to be corrected..."
                    : "Optional note..."
                }
                className={`${inputClass} min-h-[100px] resize-y py-3`}
              />
            </Field>

            <ModalActions
              saving={
                saving
              }
              primaryLabel={
                actionMode ===
                "approve"
                  ? "Approve"
                  : actionMode ===
                      "reject"
                    ? "Reject"
                    : actionMode ===
                        "reopen"
                      ? "Reopen"
                      : "Unlock"
              }
              onCancel={() => {
                setActionMode(
                  null,
                );

                setActionTimesheet(
                  null,
                );
              }}
            />
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

/* =============================================================================
 * TIMESHEET CARD
 * =============================================================================
 */

function TimesheetCard({
  timesheet,
  expanded,
  saving,

  onToggle,

  onAddEntry,
  onEditEntry,
  onDeleteEntry,

  onSubmit,
  onApprove,
  onReject,
  onReopen,
  onLock,
  onUnlock,
  onDelete,
}: {
  timesheet: Timesheet;
  expanded: boolean;
  saving: boolean;

  onToggle: () => void;

  onAddEntry: (
    date?: string,
  ) => void;

  onEditEntry: (
    entry: TimesheetEntry,
  ) => void;

  onDeleteEntry: (
    entry: TimesheetEntry,
  ) => void;

  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReopen: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onDelete: () => void;
}) {
  const days =
    useMemo(
      () =>
        timesheetDays(
          timesheet,
        ),
      [timesheet],
    );

  const expected =
    timesheet.expectedHours ??
    0;

  const progress =
    expected <= 0
      ? timesheet.totalHours >
        0
        ? 100
        : 0
      : Math.min(
          100,
          Math.max(
            0,
            (timesheet.totalHours /
              expected) *
              100,
          ),
        );

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={
          onToggle
        }
        className="w-full px-4 py-4 text-left transition hover:bg-zinc-50/70 sm:px-5"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-700">
              {initials(
                timesheet.employee
                  .name,
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-[15px] font-semibold text-zinc-950">
                  {
                    timesheet
                      .employee
                      .name
                  }
                </h3>

                <StatusBadge
                  status={
                    timesheet.status
                  }
                />

                {timesheet.timesheetRef ? (
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                    {
                      timesheet.timesheetRef
                    }
                  </span>
                ) : null}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                <span>
                  {
                    timesheet
                      .employee
                      .jobTitle
                  }
                </span>

                {timesheet.employee
                  .department ? (
                  <>
                    <span className="text-zinc-300">
                      •
                    </span>

                    <span>
                      {
                        timesheet
                          .employee
                          .department
                          .name
                      }
                    </span>
                  </>
                ) : null}

                <span className="text-zinc-300">
                  •
                </span>

                <span>
                  {
                    timesheet.entryCount
                  }{" "}
                  {timesheet.entryCount ===
                  1
                    ? "entry"
                    : "entries"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 xl:min-w-[600px]">
            <CompactMetric
              label="Expected"
              value={`${formatHours(
                timesheet.expectedHours,
              )}h`}
            />

            <CompactMetric
              label="Recorded"
              value={`${formatHours(
                timesheet.totalHours,
              )}h`}
            />

            <CompactMetric
              label="Billable"
              value={`${formatHours(
                timesheet.billableHours,
              )}h`}
            />

            <CompactMetric
              label="Remaining"
              value={`${formatHours(
                timesheet.remainingHours,
              )}h`}
            />

            <div className="hidden items-center justify-end sm:flex">
              {expanded ? (
                <ChevronDown
                  size={18}
                  className="text-zinc-400"
                />
              ) : (
                <ChevronRight
                  size={18}
                  className="text-zinc-400"
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-zinc-100">
          {/* ============================================================
              REJECTION
          ============================================================= */}

          {timesheet.status ===
            "REJECTED" &&
          timesheet.rejectionReason ? (
            <div className="border-b border-red-100 bg-red-50 px-5 py-3">
              <div className="flex items-start gap-2">
                <XCircle
                  size={16}
                  className="mt-0.5 shrink-0 text-red-500"
                />

                <div>
                  <div className="text-xs font-semibold text-red-800">
                    Changes
                    requested
                  </div>

                  <div className="mt-1 text-sm text-red-700">
                    {
                      timesheet.rejectionReason
                    }
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* ============================================================
              DAYS
          ============================================================= */}

          <div className="divide-y divide-zinc-100">
            {days.map(
              (day) => (
                <DaySection
                  key={
                    day.date
                  }
                  day={day}
                  editable={
                    timesheet
                      .permissions
                      .canEdit
                  }
                  onAdd={() =>
                    onAddEntry(
                      day.date,
                    )
                  }
                  onEdit={
                    onEditEntry
                  }
                  onDelete={
                    onDeleteEntry
                  }
                />
              ),
            )}
          </div>

          {/* ============================================================
              NOTES / REVIEW
          ============================================================= */}

          {(timesheet.employeeNote ||
            timesheet.reviewNote ||
            timesheet.reviewedBy ||
            timesheet.lockedBy) && (
            <div className="grid gap-3 border-t border-zinc-100 bg-zinc-50/60 px-5 py-4 md:grid-cols-2">
              {timesheet.employeeNote ? (
                <InfoBox
                  title="Employee note"
                  text={
                    timesheet.employeeNote
                  }
                />
              ) : null}

              {timesheet.reviewNote ? (
                <InfoBox
                  title="Review note"
                  text={
                    timesheet.reviewNote
                  }
                />
              ) : null}

              {timesheet.reviewedBy ? (
                <InfoBox
                  title="Reviewed by"
                  text={`${timesheet.reviewedBy.name}${
                    timesheet.reviewedAt
                      ? ` • ${formatDateTime(
                          timesheet.reviewedAt,
                        )}`
                      : ""
                  }`}
                />
              ) : null}

              {timesheet.lockedBy ? (
                <InfoBox
                  title="Locked by"
                  text={`${timesheet.lockedBy.name}${
                    timesheet.lockedAt
                      ? ` • ${formatDateTime(
                          timesheet.lockedAt,
                        )}`
                      : ""
                  }`}
                />
              ) : null}
            </div>
          )}

          {/* ============================================================
              FOOTER
          ============================================================= */}

          <div className="flex flex-col gap-3 border-t border-zinc-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
              <span>
                Utilisation{" "}
                <strong className="text-zinc-800">
                  {formatPercent(
                    timesheet.utilisationPercent,
                  )}
                </strong>
              </span>

              <span>
                Billable{" "}
                <strong className="text-zinc-800">
                  {formatPercent(
                    timesheet.billablePercent,
                  )}
                </strong>
              </span>

              <span>
                Non-billable{" "}
                <strong className="text-zinc-800">
                  {formatHours(
                    timesheet.nonBillableHours,
                  )}
                  h
                </strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {timesheet.permissions
                .canEdit ? (
                <button
                  type="button"
                  onClick={() =>
                    onAddEntry()
                  }
                  disabled={
                    saving
                  }
                  className={secondaryButton}
                >
                  <Plus
                    size={14}
                  />
                  Add time
                </button>
              ) : null}

              {timesheet.permissions
                .canSubmit ? (
                <button
                  type="button"
                  onClick={
                    onSubmit
                  }
                  disabled={
                    saving
                  }
                  className={primaryButton}
                >
                  <Send
                    size={14}
                  />
                  Submit
                </button>
              ) : null}

              {timesheet.permissions
                .canApprove ? (
                <button
                  type="button"
                  onClick={
                    onApprove
                  }
                  disabled={
                    saving
                  }
                  className={primaryButton}
                >
                  <Check
                    size={14}
                  />
                  Approve
                </button>
              ) : null}

              {timesheet.permissions
                .canReject ? (
                <button
                  type="button"
                  onClick={
                    onReject
                  }
                  disabled={
                    saving
                  }
                  className={dangerOutlineButton}
                >
                  <XCircle
                    size={14}
                  />
                  Reject
                </button>
              ) : null}

              {timesheet.permissions
                .canReopen ? (
                <button
                  type="button"
                  onClick={
                    onReopen
                  }
                  disabled={
                    saving
                  }
                  className={secondaryButton}
                >
                  <RotateCcw
                    size={14}
                  />
                  Reopen
                </button>
              ) : null}

              {timesheet.permissions
                .canLock ? (
                <button
                  type="button"
                  onClick={
                    onLock
                  }
                  disabled={
                    saving
                  }
                  className={secondaryButton}
                >
                  <Lock
                    size={14}
                  />
                  Lock
                </button>
              ) : null}

              {timesheet.permissions
                .canUnlock ? (
                <button
                  type="button"
                  onClick={
                    onUnlock
                  }
                  disabled={
                    saving
                  }
                  className={secondaryButton}
                >
                  <Unlock
                    size={14}
                  />
                  Unlock
                </button>
              ) : null}

              {timesheet.permissions
                .canDelete ? (
                <button
                  type="button"
                  onClick={
                    onDelete
                  }
                  disabled={
                    saving
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <Trash2
                    size={14}
                  />
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* =============================================================================
 * DAY
 * =============================================================================
 */

function DaySection({
  day,
  editable,
  onAdd,
  onEdit,
  onDelete,
}: {
  day: {
    date: string;
    dateObject: Date;
    entries: TimesheetEntry[];
    totalHours: number;
    billableHours: number;
  };

  editable: boolean;

  onAdd: () => void;

  onEdit: (
    entry: TimesheetEntry,
  ) => void;

  onDelete: (
    entry: TimesheetEntry,
  ) => void;
}) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-900">
            {day.dateObject.toLocaleDateString(
              "en-GB",
              {
                weekday:
                  "long",
                day: "numeric",
                month: "long",
              },
            )}
          </div>

          <div className="mt-0.5 text-xs text-zinc-400">
            {formatHours(
              day.totalHours,
            )}
            h recorded
            {day.billableHours >
            0
              ? ` • ${formatHours(
                  day.billableHours,
                )}h billable`
              : ""}
          </div>
        </div>

        {editable ? (
          <button
            type="button"
            onClick={
              onAdd
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
            title="Add time"
          >
            <Plus size={15} />
          </button>
        ) : null}
      </div>

      {!day.entries.length ? (
        <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-4 text-center text-xs text-zinc-400">
          No time recorded
        </div>
      ) : (
        <div className="space-y-2">
          {day.entries.map(
            (entry) => (
              <div
                key={
                  entry.id
                }
                className="group flex flex-col gap-3 rounded-xl border border-zinc-100 bg-zinc-50/70 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900">
                      {
                        entry.title
                      }
                    </span>

                    {entry.billable ? (
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Billable
                      </span>
                    ) : null}

                    {entry.invoiced ? (
                      <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        Invoiced
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                    <span>
                      {ENTRY_TYPE_LABELS[
                        entry.type
                      ] ||
                        humanise(
                          entry.type,
                        )}
                    </span>

                    {entry.client ? (
                      <>
                        <span className="text-zinc-300">
                          •
                        </span>

                        <span>
                          {entry
                            .client
                            .displayName ||
                            entry
                              .client
                              .name}
                        </span>
                      </>
                    ) : null}

                    {entry.project ? (
                      <>
                        <span className="text-zinc-300">
                          •
                        </span>

                        <span>
                          {
                            entry
                              .project
                              .name
                          }
                        </span>
                      </>
                    ) : null}

                    {entry.allocation ? (
                      <>
                        <span className="text-zinc-300">
                          •
                        </span>

                        <span className="text-zinc-600">
                          {
                            entry
                              .allocation
                              .title
                          }
                        </span>
                      </>
                    ) : null}
                  </div>

                  {entry.description ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-500">
                      {
                        entry.description
                      }
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="min-w-[55px] text-right text-sm font-semibold text-zinc-950">
                    {formatHours(
                      entry.hours,
                    )}
                    h
                  </div>

                  {editable &&
                  !entry.invoiced ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onEdit(
                            entry,
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white hover:text-zinc-900"
                      >
                        <Pencil
                          size={14}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onDelete(
                            entry,
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2
                          size={14}
                        />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* =============================================================================
 * SMALL COMPONENTS
 * =============================================================================
 */

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">
          {label}
        </span>

        <span className="text-zinc-400">
          {icon}
        </span>
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-zinc-950">
        {value}
      </div>

      <div className="mt-1 text-[11px] text-zinc-400">
        {detail}
      </div>
    </div>
  );
}

function CompactMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-zinc-900">
        {value}
      </div>
    </div>
  );
}

function StatusCount({
  label,
  count,
  status,
}: {
  label: string;
  count: number;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <StatusDot
          status={
            status
          }
        />

        <span className="text-xs font-medium text-zinc-600">
          {label}
        </span>
      </div>

      <span className="text-sm font-semibold text-zinc-900">
        {count}
      </span>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const className =
    status === "APPROVED"
      ? "bg-emerald-50 text-emerald-700"
      : status ===
          "SUBMITTED"
        ? "bg-blue-50 text-blue-700"
        : status ===
            "REJECTED"
          ? "bg-red-50 text-red-700"
          : status ===
              "LOCKED"
            ? "bg-violet-50 text-violet-700"
            : "bg-zinc-100 text-zinc-600";

  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${className}`}
    >
      {STATUS_LABELS[
        status
      ] ||
        humanise(
          status,
        )}
    </span>
  );
}

function StatusDot({
  status,
}: {
  status: string;
}) {
  const className =
    status === "APPROVED"
      ? "bg-emerald-500"
      : status ===
          "SUBMITTED"
        ? "bg-blue-500"
        : status ===
            "REJECTED"
          ? "bg-red-500"
          : status ===
              "LOCKED"
            ? "bg-violet-500"
            : "bg-zinc-400";

  return (
    <span
      className={`h-2 w-2 rounded-full ${className}`}
    />
  );
}

function SelectField({
  value,
  onChange,
  placeholder,
  options,
  disabled = false,
}: {
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target
              .value,
          )
        }
        disabled={
          disabled
        }
        className="h-10 w-full appearance-none rounded-xl border border-zinc-200 bg-white px-3 pr-9 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-400"
      >
        <option value="">
          {placeholder}
        </option>

        {options.map(
          (option) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {
                option.label
              }
            </option>
          ),
        )}
      </select>

      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
      />
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children:
    React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-zinc-700">
        {label}

        {required ? (
          <span className="ml-1 text-red-500">
            *
          </span>
        ) : null}
      </div>

      {children}
    </label>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children:
    React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl border border-zinc-200 bg-white shadow-2xl ${
          wide
            ? "max-w-3xl"
            : "max-w-lg"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-zinc-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-zinc-950">
              {title}
            </h2>

            {subtitle ? (
              <p className="mt-1 text-xs text-zinc-500">
                {subtitle}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalActions({
  saving,
  primaryLabel,
  onCancel,
}: {
  saving: boolean;
  primaryLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
      <button
        type="button"
        onClick={
          onCancel
        }
        disabled={
          saving
        }
        className={secondaryButton}
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={
          saving
        }
        className={primaryButton}
      >
        {saving ? (
          <RefreshCw
            size={14}
            className="animate-spin"
          />
        ) : (
          <Check
            size={14}
          />
        )}

        {primaryLabel}
      </button>
    </div>
  );
}

function InfoBox({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
        {title}
      </div>

      <div className="mt-1.5 text-xs leading-5 text-zinc-600">
        {text}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-16 text-center shadow-sm">
      <RefreshCw
        size={22}
        className="mx-auto animate-spin text-zinc-400"
      />

      <div className="mt-3 text-sm font-medium text-zinc-600">
        Loading
        timesheets...
      </div>
    </div>
  );
}

function EmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
        <FileClock
          size={22}
        />
      </div>

      <h3 className="mt-4 text-base font-semibold text-zinc-900">
        No timesheets
        found
      </h3>

      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-zinc-500">
        There are no
        timesheets matching
        this week and the
        selected filters.
      </p>

      {canCreate ? (
        <button
          type="button"
          onClick={
            onCreate
          }
          className={`${primaryButton} mt-5`}
        >
          <Plus size={14} />
          New timesheet
        </button>
      ) : null}
    </div>
  );
}

/* =============================================================================
 * TIMESHEET DAYS
 * =============================================================================
 */

function timesheetDays(
  timesheet: Timesheet,
) {
  const start =
    utcDateFromIso(
      timesheet.periodStart,
    );

  const end =
    utcDateFromIso(
      timesheet.periodEnd,
    );

  const result: Array<{
    date: string;
    dateObject: Date;
    entries: TimesheetEntry[];
    totalHours: number;
    billableHours: number;
  }> = [];

  let cursor =
    start;

  while (
    cursor <= end
  ) {
    const date =
      dateInput(
        cursor,
      );

    const entries =
      timesheet.entries.filter(
        (entry) =>
          dateInput(
            utcDateFromIso(
              entry.workDate,
            ),
          ) === date,
      );

    result.push({
      date,

      dateObject:
        cursor,

      entries,

      totalHours:
        entries.reduce(
          (
            total,
            entry,
          ) =>
            total +
            entry.hours,
          0,
        ),

      billableHours:
        entries.reduce(
          (
            total,
            entry,
          ) =>
            total +
            (entry.billable
              ? entry.hours
              : 0),
          0,
        ),
    });

    cursor =
      addDays(
        cursor,
        1,
      );
  }

  return result;
}

/* =============================================================================
 * API
 * =============================================================================
 */

async function apiJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response =
    await fetch(
      input,
      {
        cache:
          "no-store",

        ...init,
      },
    );

  const contentType =
    response.headers.get(
      "content-type",
    ) || "";

  const text =
    await response.text();

  let data: unknown =
    null;

  if (
    text &&
    contentType.includes(
      "application/json",
    )
  ) {
    try {
      data =
        JSON.parse(
          text,
        );
    } catch {
      throw new Error(
        `The server returned invalid JSON (HTTP ${response.status}).`,
      );
    }
  } else if (text) {
    /*
     * This catches Next.js HTML 404/500 pages and prevents:
     *
     * Unexpected token '<', "<!DOCTYPE "... is not valid JSON
     */
    if (
      !response.ok
    ) {
      throw new Error(
        `Request failed with HTTP ${response.status}. Check that the API route exists and the development server has been restarted.`,
      );
    }

    throw new Error(
      "The server returned an unexpected non-JSON response.",
    );
  }

  if (
    !response.ok
  ) {
    const object =
      isRecord(
        data,
      )
        ? data
        : null;

    throw new Error(
      typeof object?.error ===
      "string"
        ? object.error
        : `Request failed with HTTP ${response.status}.`,
    );
  }

  return data as T;
}

/* =============================================================================
 * DATE HELPERS
 * =============================================================================
 */

function getWeekRange(
  date: Date,
) {
  const source =
    new Date(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ),
    );

  const day =
    source.getUTCDay();

  const offset =
    day === 0
      ? -6
      : 1 - day;

  const start =
    addDays(
      source,
      offset,
    );

  return {
    start,

    end:
      addDays(
        start,
        7,
      ),
  };
}

function addDays(
  date: Date,
  amount: number,
) {
  const result =
    new Date(
      date.getTime(),
    );

  result.setUTCDate(
    result.getUTCDate() +
      amount,
  );

  return result;
}

function dateInput(
  date: Date,
) {
  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() +
        1,
    ).padStart(
      2,
      "0",
    ),
    String(
      date.getUTCDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join("-");
}

function utcDateFromIso(
  value: string,
) {
  const date =
    new Date(value);

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

function datetimeLocal(
  value: string | null,
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const local =
    new Date(
      date.getTime() -
        date.getTimezoneOffset() *
          60_000,
    );

  return local
    .toISOString()
    .slice(
      0,
      16,
    );
}

function formatWeekRange(
  start: Date,
  end: Date,
) {
  const sameMonth =
    start.getUTCMonth() ===
      end.getUTCMonth() &&
    start.getUTCFullYear() ===
      end.getUTCFullYear();

  if (sameMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${end.toLocaleDateString(
      "en-GB",
      {
        month:
          "short",
        year:
          "numeric",
        timeZone:
          "UTC",
      },
    )}`;
  }

  return `${start.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    },
  )} – ${end.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  )}`;
}

function formatDateTime(
  value: string,
) {
  return new Date(
    value,
  ).toLocaleString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute:
        "2-digit",
    },
  );
}

/* =============================================================================
 * GENERIC HELPERS
 * =============================================================================
 */

function formatHours(
  value:
    | number
    | null
    | undefined,
) {
  const number =
    Number(
      value ?? 0,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "0";
  }

  return number.toLocaleString(
    "en-GB",
    {
      minimumFractionDigits:
        0,
      maximumFractionDigits:
        2,
    },
  );
}

function formatPercent(
  value:
    | number
    | null
    | undefined,
) {
  return `${formatHours(
    value,
  )}%`;
}

function initials(
  name: string,
) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase() ||
        "",
    )
    .join("");
}

function humanise(
  value: string,
) {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part
          ? part[0].toUpperCase() +
            part.slice(1)
          : part,
    )
    .join(" ");
}

function errorMessage(
  error: unknown,
) {
  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null
  );
}

function updateEntryForm<
  K extends keyof EntryForm,
>(
  setter: React.Dispatch<
    React.SetStateAction<EntryForm>
  >,
  key: K,
  value: EntryForm[K],
) {
  setter(
    (current) => ({
      ...current,
      [key]: value,
    }),
  );
}

/* =============================================================================
 * STYLES
 * =============================================================================
 */

const inputClass =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-400";

const primaryButton =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButton =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";

const dangerOutlineButton =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";