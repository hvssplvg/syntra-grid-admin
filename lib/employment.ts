// lib/employment.ts
//
// Small, genuinely calendar-aware helpers for employment facts — no
// existing helper to reuse (confirmed: no date-fns dependency, no
// tenure/length-of-service calculation anywhere else in the codebase).

/**
 * Years + remaining months between a start date and now, handling
 * month/day boundaries correctly (never a naive days/365 division).
 */
export function calculateLengthOfService(startDate: Date, now: Date = new Date()): string {
  let years = now.getFullYear() - startDate.getFullYear();
  let months = now.getMonth() - startDate.getMonth();

  if (now.getDate() < startDate.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0 || (years === 0 && months <= 0)) {
    return "Less than a month";
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);

  return parts.join(", ");
}

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACTOR: "Contractor",
  INTERN: "Intern",
  TEMPORARY: "Temporary",
};

export function formatEmploymentType(value: string | null | undefined): string | null {
  if (!value) return null;
  return EMPLOYMENT_TYPE_LABEL[value] ?? value;
}

const WORK_ARRANGEMENT_LABEL: Record<string, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ONSITE: "Onsite",
};

export function formatWorkArrangement(value: string | null | undefined): string | null {
  if (!value) return null;
  return WORK_ARRANGEMENT_LABEL[value] ?? value;
}

const EMPLOYEE_STATUS_LABEL: Record<string, string> = {
  ONBOARDING: "Onboarding",
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  SUSPENDED: "Suspended",
  OFFBOARDING: "Offboarding",
  FORMER: "Former employee",
};

export function formatEmployeeStatus(value: string | null | undefined): string | null {
  if (!value) return null;
  return EMPLOYEE_STATUS_LABEL[value] ?? value;
}

/** "City, Country" from whichever of the two free-text fields are set,
 *  else the work-arrangement label, else null — never fabricated. */
export function formatWorkLocation(city: string | null, country: string | null, workArrangement: string | null): string | null {
  const parts = [city, country].filter((value): value is string => Boolean(value?.trim()));
  if (parts.length > 0) return parts.join(", ");
  return formatWorkArrangement(workArrangement);
}
