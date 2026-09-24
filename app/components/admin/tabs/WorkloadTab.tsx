/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gauge,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type Viewer = {
  adminId: string;
  employeeId: string;
  role: string;
  isWorkloadManager: boolean;
};

type Department = {
  id: string;
  name: string;
  slug?: string;
  code?: string | null;
  colour: string | null;
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
  department: Department | null;
};

type ClientOption = {
  id: string;
  name: string;
  displayName: string | null;
  clientRef: string | null;
  logoUrl: string | null;
  status: string;
  priority: string;
};

type ProjectOption = {
  id: string;
  clientId: string;

  name: string;
  slug: string;

  category: string;
  status: string;

  client: {
    id: string;
    name: string;
    displayName: string | null;
  };
};

type WorkloadEnums = {
  allocationTypes: string[];
  allocationStatuses: string[];
  priorities: string[];
  allocationModes: string[];
};

type WorkloadOptionsResponse = {
  viewer: Viewer;

  employees: EmployeeOption[];
  departments: Department[];
  clients: ClientOption[];
  projects: ProjectOption[];

  enums: WorkloadEnums;
};

type WorkSchedule = {
  id: string;

  weeklyHours: number;

  mondayHours: number;
  tuesdayHours: number;
  wednesdayHours: number;
  thursdayHours: number;
  fridayHours: number;
  saturdayHours: number;
  sundayHours: number;

  billableTargetPercent: number | null;

  timezone: string | null;

  effectiveFrom: string | null;
  effectiveUntil: string | null;
};

type WorkloadAllocation = {
  id: string;
  employeeId: string;

  title: string;
  description: string | null;

  type: string;
  status: string;
  priority: string;
  allocationMode: string;

  startDate: string;
  endDate: string;

  hoursPerWeek: number | null;
  allocationPercent: number | null;
  budgetHours: number | null;

  billable: boolean;

  department: {
    id: string;
    name: string;
    colour: string | null;
  } | null;

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

  notes: string | null;

  actualHours: number;
  actualBillableHours: number;

  createdAt: string;
  updatedAt: string;

  editable: boolean;
  deletable: boolean;
};

type WorkloadEmployee = {
  employee: EmployeeOption;

  schedule: WorkSchedule | null;

  capacity: {
    scheduledHours: number;
    leaveHours: number;
    availableHours: number;
  };

  workload: {
    allocatedHours: number;
    billableHours: number;
    nonBillableHours: number;

    remainingHours: number;

    utilisationPercent: number;
    billablePercent: number;

    targetPercent: number | null;

    overAllocatedHours: number;
    overAllocated: boolean;
  };

  actual: {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;

    utilisationPercent: number;
    billablePercent: number;
  };

  allocations: WorkloadAllocation[];
};

type WorkloadSummary = {
  employeeCount: number;

  scheduledCapacityHours: number;
  leaveHours: number;
  availableCapacityHours: number;

  allocatedHours: number;
  remainingHours: number;

  billableAllocatedHours: number;
  nonBillableAllocatedHours: number;

  actualHours: number;
  actualBillableHours: number;
  actualNonBillableHours: number;

  utilisationPercent: number;
  billablePercent: number;

  overAllocatedEmployeeCount: number;
};

type WorkloadResponse = {
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
  };

  summary: WorkloadSummary;
  employees: WorkloadEmployee[];
};

type AllocationFormState = {
  id: string | null;

  employeeId: string;

  departmentId: string;
  clientId: string;
  projectId: string;

  title: string;
  description: string;

  type: string;
  status: string;
  priority: string;

  startDate: string;
  endDate: string;

  allocationMode: string;

  hoursPerWeek: string;
  allocationPercent: string;
  budgetHours: string;

  billable: boolean;

  notes: string;
};

type ScheduleFormState = {
  employeeId: string;

  mondayHours: string;
  tuesdayHours: string;
  wednesdayHours: string;
  thursdayHours: string;
  fridayHours: string;
  saturdayHours: string;
  sundayHours: string;

  billableTargetPercent: string;

  timezone: string;

  effectiveFrom: string;
  effectiveUntil: string;

  notes: string;
};

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const EMPTY_SUMMARY: WorkloadSummary = {
  employeeCount: 0,

  scheduledCapacityHours: 0,
  leaveHours: 0,
  availableCapacityHours: 0,

  allocatedHours: 0,
  remainingHours: 0,

  billableAllocatedHours: 0,
  nonBillableAllocatedHours: 0,

  actualHours: 0,
  actualBillableHours: 0,
  actualNonBillableHours: 0,

  utilisationPercent: 0,
  billablePercent: 0,

  overAllocatedEmployeeCount: 0,
};

/* =============================================================================
 * COMPONENT
 * =============================================================================
 */

export default function WorkloadTab() {
  const initialRange = useMemo(
    () => currentWeek(),
    [],
  );

  const [rangeStart, setRangeStart] = useState(
    initialRange.start,
  );

  const [rangeEnd, setRangeEnd] = useState(
    initialRange.end,
  );

  const [options, setOptions] =
    useState<WorkloadOptionsResponse | null>(
      null,
    );

  const [data, setData] =
    useState<WorkloadResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [employeeId, setEmployeeId] =
    useState("");

  const [departmentId, setDepartmentId] =
    useState("");

  const [clientId, setClientId] =
    useState("");

  const [projectId, setProjectId] =
    useState("");

  const [allocationModal, setAllocationModal] =
    useState(false);

  const [scheduleModal, setScheduleModal] =
    useState(false);

  const [
    selectedScheduleEmployee,
    setSelectedScheduleEmployee,
  ] = useState<WorkloadEmployee | null>(
    null,
  );

  const [
    allocationForm,
    setAllocationForm,
  ] = useState<AllocationFormState>(
    () =>
      emptyAllocationForm(
        initialRange.start,
        previousDate(initialRange.end),
      ),
  );

  const [
    scheduleForm,
    setScheduleForm,
  ] = useState<ScheduleFormState>(
    emptyScheduleForm(),
  );

  const [saving, setSaving] =
    useState(false);

  /* ===========================================================================
   * LOAD OPTIONS
   * ===========================================================================
   */

  const loadOptions =
    useCallback(async () => {
      const response = await fetch(
        "/api/admin/workload/options",
        {
          cache: "no-store",
        },
      );

      const json =
        (await response.json()) as
          | WorkloadOptionsResponse
          | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in json
            ? json.error ||
                "Unable to load workload options."
            : "Unable to load workload options.",
        );
      }

      setOptions(
        json as WorkloadOptionsResponse,
      );
    }, []);

  /* ===========================================================================
   * LOAD WORKLOAD
   * ===========================================================================
   */

  const loadWorkload =
    useCallback(
      async (
        mode: "initial" | "refresh" = "refresh",
      ) => {
        try {
          if (mode === "initial") {
            setLoading(true);
          } else {
            setRefreshing(true);
          }

          setError(null);

          const params =
            new URLSearchParams();

          params.set(
            "start",
            rangeStart,
          );

          params.set(
            "end",
            rangeEnd,
          );

          if (employeeId) {
            params.set(
              "employeeId",
              employeeId,
            );
          }

          if (departmentId) {
            params.set(
              "departmentId",
              departmentId,
            );
          }

          if (clientId) {
            params.set(
              "clientId",
              clientId,
            );
          }

          if (projectId) {
            params.set(
              "projectId",
              projectId,
            );
          }

          const response =
            await fetch(
              `/api/admin/workload?${params.toString()}`,
              {
                cache:
                  "no-store",
              },
            );

          const json =
            (await response.json()) as
              | WorkloadResponse
              | {
                  error?: string;
                };

          if (!response.ok) {
            throw new Error(
              "error" in json
                ? json.error ||
                    "Unable to load workload."
                : "Unable to load workload.",
            );
          }

          setData(
            json as WorkloadResponse,
          );
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load workload.",
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        rangeStart,
        rangeEnd,
        employeeId,
        departmentId,
        clientId,
        projectId,
      ],
    );

  useEffect(() => {
    void loadOptions().catch(
      (loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load workload options.",
        );
      },
    );
  }, [loadOptions]);

  useEffect(() => {
    void loadWorkload("initial");
  }, [loadWorkload]);

  /* ===========================================================================
   * DERIVED
   * ===========================================================================
   */

  const summary =
    data?.summary ??
    EMPTY_SUMMARY;

  const filteredEmployees =
    useMemo(() => {
      const rows =
        data?.employees ?? [];

      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return rows;
      }

      return rows.filter(
        (row) => {
          const haystack = [
            row.employee.name,
            row.employee.jobTitle,
            row.employee.employeeRef,
            row.employee.department?.name,
            ...row.allocations.flatMap(
              (allocation) => [
                allocation.title,
                allocation.client
                  ?.displayName,
                allocation.client
                  ?.name,
                allocation.project
                  ?.name,
              ],
            ),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            query,
          );
        },
      );
    }, [
      data,
      search,
    ]);

  const availableProjects =
    useMemo(() => {
      if (!options) {
        return [];
      }

      if (!clientId) {
        return options.projects;
      }

      return options.projects.filter(
        (project) =>
          project.clientId ===
          clientId,
      );
    }, [
      options,
      clientId,
    ]);

  const allocationProjects =
    useMemo(() => {
      if (!options) {
        return [];
      }

      if (
        !allocationForm.clientId
      ) {
        return options.projects;
      }

      return options.projects.filter(
        (project) =>
          project.clientId ===
          allocationForm.clientId,
      );
    }, [
      options,
      allocationForm.clientId,
    ]);

  /* ===========================================================================
   * RANGE NAVIGATION
   * ===========================================================================
   */

  function previousWeek() {
    setRangeStart((value) =>
      shiftDate(value, -7),
    );

    setRangeEnd((value) =>
      shiftDate(value, -7),
    );
  }

  function nextWeek() {
    setRangeStart((value) =>
      shiftDate(value, 7),
    );

    setRangeEnd((value) =>
      shiftDate(value, 7),
    );
  }

  function goToThisWeek() {
    const week =
      currentWeek();

    setRangeStart(
      week.start,
    );

    setRangeEnd(
      week.end,
    );
  }

  /* ===========================================================================
   * ALLOCATION
   * ===========================================================================
   */

  function openNewAllocation(
    employee?: WorkloadEmployee,
  ) {
    const form =
      emptyAllocationForm(
        rangeStart,
        previousDate(rangeEnd),
      );

    if (employee) {
      form.employeeId =
        employee.employee.id;

      form.departmentId =
        employee.employee
          .department?.id ?? "";
    } else if (
      employeeId
    ) {
      form.employeeId =
        employeeId;
    }

    setAllocationForm(form);
    setAllocationModal(true);
  }

  function openEditAllocation(
    allocation: WorkloadAllocation,
  ) {
    setAllocationForm({
      id:
        allocation.id,

      employeeId:
        allocation.employeeId,

      departmentId:
        allocation.department?.id ??
        "",

      clientId:
        allocation.client?.id ??
        "",

      projectId:
        allocation.project?.id ??
        "",

      title:
        allocation.title,

      description:
        allocation.description ??
        "",

      type:
        allocation.type,

      status:
        allocation.status,

      priority:
        allocation.priority,

      startDate:
        dateInputValue(
          allocation.startDate,
        ),

      endDate:
        dateInputValue(
          allocation.endDate,
        ),

      allocationMode:
        allocation.allocationMode,

      hoursPerWeek:
        allocation.hoursPerWeek ===
        null
          ? ""
          : String(
              allocation.hoursPerWeek,
            ),

      allocationPercent:
        allocation.allocationPercent ===
        null
          ? ""
          : String(
              allocation.allocationPercent,
            ),

      budgetHours:
        allocation.budgetHours ===
        null
          ? ""
          : String(
              allocation.budgetHours,
            ),

      billable:
        allocation.billable,

      notes:
        allocation.notes ??
        "",
    });

    setAllocationModal(true);
  }

  async function saveAllocation() {
    try {
      setSaving(true);
      setError(null);

      const editing =
        Boolean(
          allocationForm.id,
        );

      const response =
        await fetch(
          editing
            ? `/api/admin/workload/allocations/${allocationForm.id}`
            : "/api/admin/workload/allocations",
          {
            method:
              editing
                ? "PATCH"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                employeeId:
                  allocationForm.employeeId,

                departmentId:
                  allocationForm.departmentId ||
                  null,

                clientId:
                  allocationForm.clientId ||
                  null,

                projectId:
                  allocationForm.projectId ||
                  null,

                title:
                  allocationForm.title,

                description:
                  allocationForm.description ||
                  null,

                type:
                  allocationForm.type,

                status:
                  allocationForm.status,

                priority:
                  allocationForm.priority,

                startDate:
                  allocationForm.startDate,

                endDate:
                  allocationForm.endDate,

                allocationMode:
                  allocationForm.allocationMode,

                hoursPerWeek:
                  allocationForm.allocationMode ===
                  "HOURS"
                    ? numberOrNull(
                        allocationForm.hoursPerWeek,
                      )
                    : null,

                allocationPercent:
                  allocationForm.allocationMode ===
                  "PERCENTAGE"
                    ? numberOrNull(
                        allocationForm.allocationPercent,
                      )
                    : null,

                budgetHours:
                  numberOrNull(
                    allocationForm.budgetHours,
                  ),

                billable:
                  allocationForm.billable,

                notes:
                  allocationForm.notes ||
                  null,
              }),
          },
        );

      const json =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          json.error ||
            "Unable to save workload allocation.",
        );
      }

      setAllocationModal(false);

      await loadWorkload(
        "refresh",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save workload allocation.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteAllocation(
    allocation: WorkloadAllocation,
  ) {
    const confirmed =
      window.confirm(
        `Remove "${allocation.title}" from the workload plan?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setError(null);

      const response =
        await fetch(
          `/api/admin/workload/allocations/${allocation.id}`,
          {
            method:
              "DELETE",
          },
        );

      const json =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          json.error ||
            "Unable to remove workload allocation.",
        );
      }

      await loadWorkload(
        "refresh",
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to remove workload allocation.",
      );
    }
  }

  /* ===========================================================================
   * SCHEDULE
   * ===========================================================================
   */

  function openSchedule(
    employee: WorkloadEmployee,
  ) {
    setSelectedScheduleEmployee(
      employee,
    );

    const schedule =
      employee.schedule;

    setScheduleForm({
      employeeId:
        employee.employee.id,

      mondayHours:
        String(
          schedule?.mondayHours ??
            8,
        ),

      tuesdayHours:
        String(
          schedule?.tuesdayHours ??
            8,
        ),

      wednesdayHours:
        String(
          schedule?.wednesdayHours ??
            8,
        ),

      thursdayHours:
        String(
          schedule?.thursdayHours ??
            8,
        ),

      fridayHours:
        String(
          schedule?.fridayHours ??
            8,
        ),

      saturdayHours:
        String(
          schedule?.saturdayHours ??
            0,
        ),

      sundayHours:
        String(
          schedule?.sundayHours ??
            0,
        ),

      billableTargetPercent:
        schedule?.billableTargetPercent ===
        null ||
        schedule?.billableTargetPercent ===
        undefined
          ? ""
          : String(
              schedule.billableTargetPercent,
            ),

      timezone:
        schedule?.timezone ??
        "Europe/London",

      effectiveFrom:
        schedule?.effectiveFrom
          ? dateInputValue(
              schedule.effectiveFrom,
            )
          : "",

      effectiveUntil:
        schedule?.effectiveUntil
          ? dateInputValue(
              schedule.effectiveUntil,
            )
          : "",

      notes: "",
    });

    setScheduleModal(true);
  }

  async function saveSchedule() {
    if (
      !selectedScheduleEmployee
    ) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const existingSchedule =
        selectedScheduleEmployee.schedule;

      const response =
        await fetch(
          existingSchedule
            ? `/api/admin/workload/schedules/${existingSchedule.id}`
            : "/api/admin/workload/schedules",
          {
            method:
              existingSchedule
                ? "PATCH"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                employeeId:
                  scheduleForm.employeeId,

                mondayHours:
                  numberOrZero(
                    scheduleForm.mondayHours,
                  ),

                tuesdayHours:
                  numberOrZero(
                    scheduleForm.tuesdayHours,
                  ),

                wednesdayHours:
                  numberOrZero(
                    scheduleForm.wednesdayHours,
                  ),

                thursdayHours:
                  numberOrZero(
                    scheduleForm.thursdayHours,
                  ),

                fridayHours:
                  numberOrZero(
                    scheduleForm.fridayHours,
                  ),

                saturdayHours:
                  numberOrZero(
                    scheduleForm.saturdayHours,
                  ),

                sundayHours:
                  numberOrZero(
                    scheduleForm.sundayHours,
                  ),

                billableTargetPercent:
                  numberOrNull(
                    scheduleForm.billableTargetPercent,
                  ),

                timezone:
                  scheduleForm.timezone ||
                  null,

                effectiveFrom:
                  scheduleForm.effectiveFrom ||
                  null,

                effectiveUntil:
                  scheduleForm.effectiveUntil ||
                  null,

                notes:
                  scheduleForm.notes ||
                  null,

                active:
                  true,
              }),
          },
        );

      const json =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          json.error ||
            "Unable to save work schedule.",
        );
      }

      setScheduleModal(false);

      setSelectedScheduleEmployee(
        null,
      );

      await loadWorkload(
        "refresh",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save work schedule.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* ===========================================================================
   * RENDER
   * ===========================================================================
   */

  if (
    loading &&
    !data
  ) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading workload…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* =======================================================================
          HEADER
      ======================================================================= */}

      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
            <Activity className="h-4 w-4" />
            Company operations
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            Workload
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            Plan team capacity, account for leave,
            allocate client and project work, and
            compare planned hours against actual
            recorded time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void loadWorkload(
                "refresh",
              )
            }
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing
                  ? "animate-spin"
                  : ""
              }`}
            />

            Refresh
          </button>

          {options?.viewer
            .isWorkloadManager && (
            <button
              type="button"
              onClick={() =>
                openNewAllocation()
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" />
              Add allocation
            </button>
          )}
        </div>
      </section>

      {/* =======================================================================
          ERROR
      ======================================================================= */}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

          <div className="flex-1">
            {error}
          </div>

          <button
            type="button"
            onClick={() =>
              setError(null)
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* =======================================================================
          DATE RANGE
      ======================================================================= */}

      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={previousWeek}
            className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={goToThisWeek}
            className="h-9 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            This week
          </button>

          <button
            type="button"
            onClick={nextWeek}
            className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="ml-2 hidden text-sm font-medium text-zinc-800 sm:block">
            {formatRange(
              rangeStart,
              rangeEnd,
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={rangeStart}
            onChange={(event) =>
              setRangeStart(
                event.target.value,
              )
            }
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
          />

          <span className="text-xs text-zinc-400">
            to
          </span>

          <input
            type="date"
            value={rangeEnd}
            onChange={(event) =>
              setRangeEnd(
                event.target.value,
              )
            }
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
          />
        </div>
      </section>

      {/* =======================================================================
          SUMMARY
      ======================================================================= */}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="People"
          value={String(
            summary.employeeCount,
          )}
          detail={`${hours(summary.availableCapacityHours)} available capacity`}
        />

        <MetricCard
          icon={<Gauge className="h-4 w-4" />}
          label="Planned utilisation"
          value={`${formatNumber(summary.utilisationPercent)}%`}
          detail={`${hours(summary.allocatedHours)} of ${hours(summary.availableCapacityHours)}`}
          warning={
            summary.overAllocatedEmployeeCount >
            0
          }
        />

        <MetricCard
          icon={<Target className="h-4 w-4" />}
          label="Billable plan"
          value={`${formatNumber(summary.billablePercent)}%`}
          detail={`${hours(summary.billableAllocatedHours)} billable`}
        />

        <MetricCard
          icon={<Clock3 className="h-4 w-4" />}
          label="Actual recorded"
          value={hours(
            summary.actualHours,
          )}
          detail={`${hours(summary.actualBillableHours)} billable`}
        />
      </section>

      {/* =======================================================================
          CAPACITY STRIP
      ======================================================================= */}

      <section className="grid overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm md:grid-cols-4">
        <CapacityStat
          label="Scheduled"
          value={summary.scheduledCapacityHours}
        />

        <CapacityStat
          label="Leave"
          value={summary.leaveHours}
        />

        <CapacityStat
          label="Available"
          value={summary.availableCapacityHours}
        />

        <CapacityStat
          label="Remaining"
          value={summary.remainingHours}
          warning={
            summary.remainingHours <
            0
          }
        />
      </section>

      {/* =======================================================================
          FILTERS
      ======================================================================= */}

      <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search workload…"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-zinc-400"
            />
          </div>

          <select
            value={employeeId}
            onChange={(event) =>
              setEmployeeId(
                event.target.value,
              )
            }
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-zinc-400"
          >
            <option value="">
              All employees
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
                  {employee.name}
                </option>
              ),
            )}
          </select>

          <select
            value={departmentId}
            onChange={(event) =>
              setDepartmentId(
                event.target.value,
              )
            }
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-zinc-400"
          >
            <option value="">
              All departments
            </option>

            {options?.departments.map(
              (department) => (
                <option
                  key={
                    department.id
                  }
                  value={
                    department.id
                  }
                >
                  {
                    department.name
                  }
                </option>
              ),
            )}
          </select>

          <select
            value={clientId}
            onChange={(event) => {
              const value =
                event.target.value;

              setClientId(value);

              if (
                projectId &&
                !options?.projects.some(
                  (project) =>
                    project.id ===
                      projectId &&
                    (!value ||
                      project.clientId ===
                        value),
                )
              ) {
                setProjectId("");
              }
            }}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-zinc-400"
          >
            <option value="">
              All clients
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

          <select
            value={projectId}
            onChange={(event) =>
              setProjectId(
                event.target.value,
              )
            }
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-zinc-400"
          >
            <option value="">
              All projects
            </option>

            {availableProjects.map(
              (project) => (
                <option
                  key={
                    project.id
                  }
                  value={
                    project.id
                  }
                >
                  {project.name}
                </option>
              ),
            )}
          </select>
        </div>
      </section>

      {/* =======================================================================
          TEAM
      ======================================================================= */}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-zinc-950">
              Team capacity
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              Planned and actual work for the selected period.
            </p>
          </div>

          <div className="text-xs text-zinc-400">
            {filteredEmployees.length}{" "}
            {filteredEmployees.length ===
            1
              ? "person"
              : "people"}
          </div>
        </div>

        {filteredEmployees.length ===
        0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-zinc-100">
            {filteredEmployees.map(
              (row) => (
                <EmployeeRow
                  key={
                    row.employee.id
                  }
                  row={row}
                  manager={
                    Boolean(
                      options?.viewer
                        .isWorkloadManager,
                    )
                  }
                  onAdd={() =>
                    openNewAllocation(
                      row,
                    )
                  }
                  onEditAllocation={
                    openEditAllocation
                  }
                  onDeleteAllocation={
                    deleteAllocation
                  }
                  onSchedule={() =>
                    openSchedule(row)
                  }
                />
              ),
            )}
          </div>
        )}
      </section>

      {/* =======================================================================
          ALLOCATION MODAL
      ======================================================================= */}

      {allocationModal && (
        <ModalShell
          title={
            allocationForm.id
              ? "Edit allocation"
              : "Add allocation"
          }
          description="Plan work against an employee, client or project."
          onClose={() =>
            setAllocationModal(
              false,
            )
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Employee"
              required
            >
              <select
                value={
                  allocationForm.employeeId
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) => ({
                      ...current,
                      employeeId:
                        event.target
                          .value,
                    }),
                  )
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

            <Field
              label="Department"
            >
              <select
                value={
                  allocationForm.departmentId
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) => ({
                      ...current,
                      departmentId:
                        event.target
                          .value,
                    }),
                  )
                }
                className={inputClass}
              >
                <option value="">
                  Employee department
                </option>

                {options?.departments.map(
                  (department) => (
                    <option
                      key={
                        department.id
                      }
                      value={
                        department.id
                      }
                    >
                      {
                        department.name
                      }
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field
              label="Title"
              required
              className="sm:col-span-2"
            >
              <input
                value={
                  allocationForm.title
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) => ({
                      ...current,
                      title:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="e.g. RentWise estate dashboard"
                className={inputClass}
              />
            </Field>

            <Field label="Client">
              <select
                value={
                  allocationForm.clientId
                }
                onChange={(event) => {
                  const value =
                    event.target.value;

                  setAllocationForm(
                    (current) => ({
                      ...current,
                      clientId:
                        value,

                      projectId:
                        current.projectId &&
                        options?.projects.some(
                          (
                            project,
                          ) =>
                            project.id ===
                              current.projectId &&
                            (!value ||
                              project.clientId ===
                                value),
                        )
                          ? current.projectId
                          : "",
                    }),
                  );
                }}
                className={inputClass}
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
                  allocationForm.projectId
                }
                onChange={(event) => {
                  const selectedId =
                    event.target.value;

                  const selectedProject =
                    options?.projects.find(
                      (project) =>
                        project.id ===
                        selectedId,
                    );

                  setAllocationForm(
                    (current) => ({
                      ...current,

                      projectId:
                        selectedId,

                      clientId:
                        selectedProject
                          ?.clientId ??
                        current.clientId,
                    }),
                  );
                }}
                className={inputClass}
              >
                <option value="">
                  No project
                </option>

                {allocationProjects.map(
                  (project) => (
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

            <Field label="Type">
              <select
                value={
                  allocationForm.type
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) => ({
                      ...current,
                      type:
                        event.target
                          .value,
                    }),
                  )
                }
                className={inputClass}
              >
                {options?.enums.allocationTypes.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {prettyEnum(
                        value,
                      )}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field label="Priority">
              <select
                value={
                  allocationForm.priority
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) => ({
                      ...current,
                      priority:
                        event.target
                          .value,
                    }),
                  )
                }
                className={inputClass}
              >
                {options?.enums.priorities.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {prettyEnum(
                        value,
                      )}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field label="Status">
              <select
                value={
                  allocationForm.status
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) => ({
                      ...current,
                      status:
                        event.target
                          .value,
                    }),
                  )
                }
                className={inputClass}
              >
                {options?.enums.allocationStatuses.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {prettyEnum(
                        value,
                      )}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field label="Allocation mode">
              <select
                value={
                  allocationForm.allocationMode
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) => ({
                      ...current,

                      allocationMode:
                        event.target
                          .value,

                      hoursPerWeek:
                        event.target
                          .value ===
                        "HOURS"
                          ? current.hoursPerWeek ||
                            "8"
                          : "",

                      allocationPercent:
                        event.target
                          .value ===
                        "PERCENTAGE"
                          ? current.allocationPercent ||
                            "20"
                          : "",
                    }),
                  )
                }
                className={inputClass}
              >
                {options?.enums.allocationModes.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {prettyEnum(
                        value,
                      )}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field
              label={
                allocationForm.allocationMode ===
                "PERCENTAGE"
                  ? "Allocation %"
                  : "Hours / week"
              }
              required
            >
              <input
                type="number"
                min="0"
                step="0.25"
                value={
                  allocationForm.allocationMode ===
                  "PERCENTAGE"
                    ? allocationForm.allocationPercent
                    : allocationForm.hoursPerWeek
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) =>
                      current.allocationMode ===
                      "PERCENTAGE"
                        ? {
                            ...current,
                            allocationPercent:
                              event
                                .target
                                .value,
                          }
                        : {
                            ...current,
                            hoursPerWeek:
                              event
                                .target
                                .value,
                          },
                  )
                }
                className={inputClass}
              />
            </Field>

            <Field
              label="Start date"
              required
            >
              <input
                type="date"
                value={
                  allocationForm.startDate
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) => ({
                      ...current,
                      startDate:
                        event.target
                          .value,
                    }),
                  )
                }
                className={inputClass}
              />
            </Field>

            <Field
              label="End date"
              required
            >
              <input
                type="date"
                value={
                  allocationForm.endDate
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) => ({
                      ...current,
                      endDate:
                        event.target
                          .value,
                    }),
                  )
                }
                className={inputClass}
              />
            </Field>

            <Field label="Budget hours">
              <input
                type="number"
                min="0"
                step="0.25"
                value={
                  allocationForm.budgetHours
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) => ({
                      ...current,
                      budgetHours:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="Optional"
                className={inputClass}
              />
            </Field>

            <Field label="Billing">
              <label className="flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 px-3">
                <input
                  type="checkbox"
                  checked={
                    allocationForm.billable
                  }
                  onChange={(event) =>
                    setAllocationForm(
                      (current) => ({
                        ...current,
                        billable:
                          event.target
                            .checked,
                      }),
                    )
                  }
                  className="h-4 w-4"
                />

                <span className="text-sm text-zinc-700">
                  Billable work
                </span>
              </label>
            </Field>

            <Field
              label="Description"
              className="sm:col-span-2"
            >
              <textarea
                rows={3}
                value={
                  allocationForm.description
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) => ({
                      ...current,
                      description:
                        event.target
                          .value,
                    }),
                  )
                }
                className={`${inputClass} h-auto py-3`}
              />
            </Field>

            <Field
              label="Internal notes"
              className="sm:col-span-2"
            >
              <textarea
                rows={3}
                value={
                  allocationForm.notes
                }
                onChange={(event) =>
                  setAllocationForm(
                    (current) => ({
                      ...current,
                      notes:
                        event.target
                          .value,
                    }),
                  )
                }
                className={`${inputClass} h-auto py-3`}
              />
            </Field>
          </div>

          <ModalActions
            saving={saving}
            onCancel={() =>
              setAllocationModal(
                false,
              )
            }
            onSave={() =>
              void saveAllocation()
            }
            saveLabel={
              allocationForm.id
                ? "Save changes"
                : "Create allocation"
            }
          />
        </ModalShell>
      )}

      {/* =======================================================================
          SCHEDULE MODAL
      ======================================================================= */}

      {scheduleModal &&
        selectedScheduleEmployee && (
          <ModalShell
            title="Work schedule"
            description={`Set the normal working capacity for ${selectedScheduleEmployee.employee.name}.`}
            onClose={() =>
              setScheduleModal(
                false,
              )
            }
          >
            <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="text-sm font-medium text-zinc-900">
                {
                  selectedScheduleEmployee
                    .employee.name
                }
              </div>

              <div className="mt-1 text-xs text-zinc-500">
                {
                  selectedScheduleEmployee
                    .employee.jobTitle
                }
                {selectedScheduleEmployee
                  .employee.department
                  ?.name
                  ? ` · ${selectedScheduleEmployee.employee.department.name}`
                  : ""}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [
                  "Monday",
                  "mondayHours",
                ],
                [
                  "Tuesday",
                  "tuesdayHours",
                ],
                [
                  "Wednesday",
                  "wednesdayHours",
                ],
                [
                  "Thursday",
                  "thursdayHours",
                ],
                [
                  "Friday",
                  "fridayHours",
                ],
                [
                  "Saturday",
                  "saturdayHours",
                ],
                [
                  "Sunday",
                  "sundayHours",
                ],
              ].map(
                ([label, key]) => (
                  <Field
                    key={key}
                    label={`${label} hours`}
                  >
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="0.25"
                      value={
                        scheduleForm[
                          key as keyof ScheduleFormState
                        ]
                      }
                      onChange={(
                        event,
                      ) =>
                        setScheduleForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            [key]:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      className={
                        inputClass
                      }
                    />
                  </Field>
                ),
              )}

              <Field label="Billable target %">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={
                    scheduleForm.billableTargetPercent
                  }
                  onChange={(event) =>
                    setScheduleForm(
                      (current) => ({
                        ...current,
                        billableTargetPercent:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="Timezone">
                <input
                  value={
                    scheduleForm.timezone
                  }
                  onChange={(event) =>
                    setScheduleForm(
                      (current) => ({
                        ...current,
                        timezone:
                          event.target
                            .value,
                      }),
                    )
                  }
                  placeholder="Europe/London"
                  className={inputClass}
                />
              </Field>

              <Field label="Effective from">
                <input
                  type="date"
                  value={
                    scheduleForm.effectiveFrom
                  }
                  onChange={(event) =>
                    setScheduleForm(
                      (current) => ({
                        ...current,
                        effectiveFrom:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="Effective until">
                <input
                  type="date"
                  value={
                    scheduleForm.effectiveUntil
                  }
                  onChange={(event) =>
                    setScheduleForm(
                      (current) => ({
                        ...current,
                        effectiveUntil:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={inputClass}
                />
              </Field>

              <Field
                label="Notes"
                className="sm:col-span-2"
              >
                <textarea
                  rows={3}
                  value={
                    scheduleForm.notes
                  }
                  onChange={(event) =>
                    setScheduleForm(
                      (current) => ({
                        ...current,
                        notes:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={`${inputClass} h-auto py-3`}
                />
              </Field>
            </div>

            <ModalActions
              saving={saving}
              onCancel={() =>
                setScheduleModal(
                  false,
                )
              }
              onSave={() =>
                void saveSchedule()
              }
              saveLabel="Save schedule"
            />
          </ModalShell>
        )}
    </div>
  );
}

/* =============================================================================
 * EMPLOYEE ROW
 * =============================================================================
 */

function EmployeeRow({
  row,
  manager,
  onAdd,
  onEditAllocation,
  onDeleteAllocation,
  onSchedule,
}: {
  row: WorkloadEmployee;
  manager: boolean;
  onAdd: () => void;
  onEditAllocation: (
    allocation: WorkloadAllocation,
  ) => void;
  onDeleteAllocation: (
    allocation: WorkloadAllocation,
  ) => void;
  onSchedule: () => void;
}) {
  const [expanded, setExpanded] =
    useState(true);

  const utilisation =
    row.workload.utilisationPercent;

  return (
    <div>
      <div className="p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar
              employee={
                row.employee
              }
            />

            <div className="min-w-0">
              <div className="truncate font-medium text-zinc-950">
                {
                  row.employee
                    .name
                }
              </div>

              <div className="mt-0.5 truncate text-xs text-zinc-500">
                {
                  row.employee
                    .jobTitle
                }

                {row.employee
                  .department
                  ?.name
                  ? ` · ${row.employee.department.name}`
                  : ""}
              </div>
            </div>
          </div>

          <div className="grid flex-[2] grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat
              label="Available"
              value={hours(
                row.capacity
                  .availableHours,
              )}
              sub={
                row.capacity
                  .leaveHours > 0
                  ? `${hours(row.capacity.leaveHours)} leave`
                  : `${hours(row.capacity.scheduledHours)} scheduled`
              }
            />

            <MiniStat
              label="Allocated"
              value={hours(
                row.workload
                  .allocatedHours,
              )}
              sub={`${formatNumber(utilisation)}% utilised`}
              warning={
                row.workload
                  .overAllocated
              }
            />

            <MiniStat
              label="Remaining"
              value={hours(
                row.workload
                  .remainingHours,
              )}
              sub={
                row.workload
                  .overAllocated
                  ? `${hours(row.workload.overAllocatedHours)} over`
                  : "Capacity left"
              }
              warning={
                row.workload
                  .overAllocated
              }
            />

            <MiniStat
              label="Actual"
              value={hours(
                row.actual
                  .totalHours,
              )}
              sub={`${hours(row.actual.billableHours)} billable`}
            />
          </div>

          <div className="flex items-center gap-2">
            {manager && (
              <>
                <button
                  type="button"
                  onClick={onSchedule}
                  title="Work schedule"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
                >
                  <CalendarDays className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={onAdd}
                  title="Add allocation"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() =>
                setExpanded(
                  (value) =>
                    !value,
                )
              }
              className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <UtilisationBar
            percent={utilisation}
            over={
              row.workload
                .overAllocated
            }
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-4">
          {row.allocations.length ===
          0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-5 text-center text-sm text-zinc-400">
              No planned work in this period.
            </div>
          ) : (
            <div className="space-y-2">
              {row.allocations.map(
                (allocation) => (
                  <AllocationRow
                    key={
                      allocation.id
                    }
                    allocation={
                      allocation
                    }
                    onEdit={() =>
                      onEditAllocation(
                        allocation,
                      )
                    }
                    onDelete={() =>
                      onDeleteAllocation(
                        allocation,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =============================================================================
 * ALLOCATION ROW
 * =============================================================================
 */

function AllocationRow({
  allocation,
  onEdit,
  onDelete,
}: {
  allocation: WorkloadAllocation;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-zinc-900">
            {allocation.title}
          </span>

          <Badge>
            {prettyEnum(
              allocation.status,
            )}
          </Badge>

          {allocation.billable && (
            <Badge>
              Billable
            </Badge>
          )}
        </div>

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
          {allocation.client && (
            <span>
              {allocation.client
                .displayName ||
                allocation.client
                  .name}
            </span>
          )}

          {allocation.project && (
            <span>
              {
                allocation
                  .project.name
              }
            </span>
          )}

          <span>
            {prettyEnum(
              allocation.type,
            )}
          </span>

          <span>
            {formatShortDate(
              allocation.startDate,
            )}{" "}
            –{" "}
            {formatShortDate(
              allocation.endDate,
            )}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 text-right text-xs">
        <div>
          <div className="text-zinc-400">
            Planned
          </div>

          <div className="mt-1 font-medium text-zinc-900">
            {allocation.allocationMode ===
            "PERCENTAGE"
              ? `${formatNumber(allocation.allocationPercent ?? 0)}%`
              : `${formatNumber(allocation.hoursPerWeek ?? 0)}h/w`}
          </div>
        </div>

        <div>
          <div className="text-zinc-400">
            Actual
          </div>

          <div className="mt-1 font-medium text-zinc-900">
            {hours(
              allocation.actualHours,
            )}
          </div>
        </div>

        <div>
          <div className="text-zinc-400">
            Priority
          </div>

          <div className="mt-1 font-medium text-zinc-900">
            {prettyEnum(
              allocation.priority,
            )}
          </div>
        </div>
      </div>

      {allocation.editable && (
        <div className="flex items-center gap-1 lg:ml-2">
          <button
            type="button"
            onClick={onEdit}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* =============================================================================
 * SMALL UI COMPONENTS
 * =============================================================================
 */

function MetricCard({
  icon,
  label,
  value,
  detail,
  warning = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500">
          {label}
        </div>

        <div
          className={`grid h-8 w-8 place-items-center rounded-lg ${
            warning
              ? "bg-red-50 text-red-600"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {icon}
        </div>
      </div>

      <div
        className={`mt-4 text-2xl font-semibold tracking-tight ${
          warning
            ? "text-red-600"
            : "text-zinc-950"
        }`}
      >
        {value}
      </div>

      <div className="mt-1 text-xs text-zinc-400">
        {detail}
      </div>
    </div>
  );
}

function CapacityStat({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className="border-b border-zinc-100 px-5 py-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="text-xs text-zinc-400">
        {label}
      </div>

      <div
        className={`mt-1 text-lg font-semibold ${
          warning
            ? "text-red-600"
            : "text-zinc-900"
        }`}
      >
        {hours(value)}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  warning = false,
}: {
  label: string;
  value: string;
  sub: string;
  warning?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-zinc-400">
        {label}
      </div>

      <div
        className={`mt-1 text-sm font-semibold ${
          warning
            ? "text-red-600"
            : "text-zinc-900"
        }`}
      >
        {value}
      </div>

      <div className="mt-0.5 text-[11px] text-zinc-400">
        {sub}
      </div>
    </div>
  );
}

function UtilisationBar({
  percent,
  over,
}: {
  percent: number;
  over: boolean;
}) {
  const width =
    Math.min(
      Math.max(percent, 0),
      100,
    );

  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
      <div
        className={`h-full rounded-full ${
          over
            ? "bg-red-500"
            : percent >= 85
              ? "bg-amber-500"
              : "bg-zinc-900"
        }`}
        style={{
          width: `${width}%`,
        }}
      />
    </div>
  );
}

function Avatar({
  employee,
}: {
  employee: EmployeeOption;
}) {
  if (employee.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={employee.avatarUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-xl object-cover"
      />
    );
  }

  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-600">
      {initials(
        employee.name,
      )}
    </div>
  );
}

function Badge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-zinc-100 text-zinc-400">
        <UserRound className="h-5 w-5" />
      </div>

      <div className="mt-4 font-medium text-zinc-900">
        No workload found
      </div>

      <div className="mx-auto mt-1 max-w-sm text-sm leading-6 text-zinc-500">
        No employees match the current filters and selected period.
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`block ${className}`}
    >
      <span className="mb-1.5 block text-xs font-medium text-zinc-600">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

function ModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-zinc-100 bg-white px-5 py-4">
          <div>
            <h2 className="font-semibold text-zinc-950">
              {title}
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" />
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
  onCancel,
  onSave,
  saveLabel,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="h-10 rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}

        {saveLabel}
      </button>
    </div>
  );
}

/* =============================================================================
 * FORM HELPERS
 * =============================================================================
 */

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-300 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100";

function emptyAllocationForm(
  startDate: string,
  endDate: string,
): AllocationFormState {
  return {
    id: null,

    employeeId: "",

    departmentId: "",
    clientId: "",
    projectId: "",

    title: "",
    description: "",

    type: "PROJECT",
    status: "PLANNED",
    priority: "NORMAL",

    startDate,
    endDate,

    allocationMode: "HOURS",

    hoursPerWeek: "8",
    allocationPercent: "",
    budgetHours: "",

    billable: true,

    notes: "",
  };
}

function emptyScheduleForm(): ScheduleFormState {
  return {
    employeeId: "",

    mondayHours: "8",
    tuesdayHours: "8",
    wednesdayHours: "8",
    thursdayHours: "8",
    fridayHours: "8",
    saturdayHours: "0",
    sundayHours: "0",

    billableTargetPercent: "",

    timezone: "Europe/London",

    effectiveFrom: "",
    effectiveUntil: "",

    notes: "",
  };
}

/* =============================================================================
 * DATE HELPERS
 * =============================================================================
 */

function currentWeek() {
  const now =
    new Date();

  const date =
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    );

  const day =
    date.getUTCDay();

  const offset =
    day === 0
      ? -6
      : 1 - day;

  date.setUTCDate(
    date.getUTCDate() +
      offset,
  );

  const start =
    date
      .toISOString()
      .slice(0, 10);

  date.setUTCDate(
    date.getUTCDate() + 7,
  );

  const end =
    date
      .toISOString()
      .slice(0, 10);

  return {
    start,
    end,
  };
}

function shiftDate(
  value: string,
  days: number,
) {
  const date =
    new Date(
      `${value}T00:00:00.000Z`,
    );

  date.setUTCDate(
    date.getUTCDate() +
      days,
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function previousDate(
  value: string,
) {
  return shiftDate(
    value,
    -1,
  );
}

function dateInputValue(
  value: string,
) {
  return new Date(value)
    .toISOString()
    .slice(0, 10);
}

function formatRange(
  start: string,
  end: string,
) {
  const endInclusive =
    previousDate(end);

  const startDate =
    new Date(
      `${start}T00:00:00.000Z`,
    );

  const endDate =
    new Date(
      `${endInclusive}T00:00:00.000Z`,
    );

  return `${startDate.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    },
  )} – ${endDate.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  )}`;
}

function formatShortDate(
  value: string,
) {
  return new Date(
    value,
  ).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    },
  );
}

/* =============================================================================
 * DISPLAY HELPERS
 * =============================================================================
 */

function numberOrNull(
  value: string,
): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

function numberOrZero(
  value: string,
): number {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}

function hours(
  value: number,
) {
  return `${formatNumber(value)}h`;
}

function formatNumber(
  value: number,
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function prettyEnum(
  value: string,
) {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

function initials(
  name: string,
) {
  const result =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]?.toUpperCase(),
      )
      .join("");

  return result || "?";
}