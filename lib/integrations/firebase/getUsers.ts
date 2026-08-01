// lib/integrations/firebase/getUsers.ts
//
// Reads the client's user base and runs the integrity checks that matter to
// Syntra Grid. Schema mirrors what CreateUser.js writes:
//
//   users/{uid}          — every account, all four roles
//   students/{studentId} — mirror of student users
//   staff/{staffId}      — mirror of teacher/admin/staff users
//   classes/{classId}
//   systemCounters/school_esteem — { studentCounter, teacherCounter, ... }
//
// NOTE ON THE DB HANDLE: this imports the same admin Firestore instance that
// getOverview.ts uses. If getOverview.ts initialises the app inline rather
// than importing it, export the handle from there and change this import to
// match — everything below only needs a firebase-admin Firestore.
import { esteemFirestore as esteemDb } from './client';

const SCHOOL_ID = 'school_esteem';
const COUNTER_DOC = 'school_esteem';

/** ID prefixes issued by formatGeneratedId() in CreateUser.js. */
const ID_PREFIX: Record<EsteemRole, string> = {
  student: 'ELC-STD-',
  teacher: 'ELC-TCH-',
  admin: 'ELC-ADM-',
  staff: 'ELC-STF-',
};

const COUNTER_KEY: Record<EsteemRole, string> = {
  student: 'studentCounter',
  teacher: 'teacherCounter',
  admin: 'adminCounter',
  staff: 'staffCounter',
};

export type EsteemRole = 'student' | 'teacher' | 'admin' | 'staff';

export type EsteemUserRow = {
  uid: string;
  fullName: string;
  email: string;
  role: EsteemRole | 'unknown';
  /** studentId for students, staffId for everyone else. */
  displayId: string;
  isActive: boolean;
  /** Still holding the generated temporary password — has never signed in. */
  neverSignedIn: boolean;
  createdAt: string | null;
  className: string | null;
  position: string | null;
  subjects: string[];
  formClasses: string[];
  /** null for students and teachers, who don't use the admin dashboard. */
  dashboardAccess: boolean | null;
  /** 'full' for the ['*'] wildcard, a count otherwise, null where N/A. */
  permissionScope: 'full' | number | null;
  accessLevel: string | null;
  /** Whether the students/ or staff/ mirror document exists. */
  mirrored: boolean;
  photoURL: string | null;
};

export type IntegrityIssue = {
  code: string;
  severity: 'critical' | 'warn' | 'info';
  title: string;
  detail: string;
  /** Human-readable identifiers, capped at 12 for display. */
  affected: string[];
  affectedCount: number;
};

export type CounterState = {
  role: EsteemRole;
  counter: number;
  highestIssued: number;
  /** True when the next create would reuse an ID that already exists. */
  willCollide: boolean;
};

export type EsteemUsersPayload = {
  users: EsteemUserRow[];
  counts: {
    total: number;
    student: number;
    teacher: number;
    admin: number;
    staff: number;
    deactivated: number;
    neverSignedIn: number;
    noDashboardAccess: number;
  };
  counters: CounterState[];
  issues: IntegrityIssue[];
  fetchedAt: string;
};

/* ─────────────────────── helpers ─────────────────────── */

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  // Firestore Timestamp
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

function idNumber(displayId: string, role: EsteemRole): number {
  const prefix = ID_PREFIX[role];
  if (!displayId.startsWith(prefix)) return 0;
  const parsed = Number.parseInt(displayId.slice(prefix.length), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRole(value: unknown): value is EsteemRole {
  return value === 'student' || value === 'teacher' || value === 'admin' || value === 'staff';
}

function permissionScope(
  role: EsteemRole | 'unknown',
  permissions: unknown,
): 'full' | number | null {
  if (role !== 'admin' && role !== 'staff') return null;
  if (!Array.isArray(permissions)) {
    // Legacy admins with no permissions field are treated as full access by
    // canAccessTab() in CreateUser.js — reflect that here rather than showing 0.
    return role === 'admin' ? 'full' : 0;
  }
  if (permissions.includes('*')) return 'full';
  return permissions.length;
}

function positionOf(role: EsteemRole | 'unknown', data: Record<string, unknown>): string | null {
  if (role === 'admin') return (data.adminPosition as string) || (data.adminTitle as string) || null;
  if (role === 'staff') return (data.staffPosition as string) || null;
  if (role === 'teacher') return (data.position as string) || 'Teacher';
  return null;
}

function cap(list: string[], limit = 12): string[] {
  return list.slice(0, limit);
}

/* ─────────────────────── main read ─────────────────────── */

export async function getEsteemUsers(): Promise<EsteemUsersPayload> {
  const [usersSnap, studentsSnap, staffSnap, classesSnap, counterSnap] = await Promise.all([
    esteemDb.collection('users').get(),
    esteemDb.collection('students').select('userId', 'uid').get(),
    esteemDb.collection('staff').select('userId', 'uid').get(),
    esteemDb.collection('classes').select('name').get(),
    esteemDb.collection('systemCounters').doc(COUNTER_DOC).get(),
  ]);

  const studentDocIds = new Set(studentsSnap.docs.map((d) => d.id));
  const staffDocIds = new Set(staffSnap.docs.map((d) => d.id));
  const classIds = new Set(classesSnap.docs.map((d) => d.id));

  const mirrorOwners = new Map<string, string>(); // mirror doc id -> uid it claims
  for (const d of [...studentsSnap.docs, ...staffSnap.docs]) {
    const data = d.data() as { userId?: string; uid?: string };
    mirrorOwners.set(d.id, data.userId || data.uid || '');
  }

  const users: EsteemUserRow[] = [];
  const seenDisplayIds = new Map<string, string[]>(); // displayId -> [names]

  // Issue accumulators
  const missingMirror: string[] = [];
  const noRole: string[] = [];
  const studentNoClass: string[] = [];
  const studentBadClass: string[] = [];
  const teacherNoSubjects: string[] = [];
  const dashboardNoPermissions: string[] = [];
  const wrongSchool: string[] = [];
  const highestIssued: Record<EsteemRole, number> = {
    student: 0,
    teacher: 0,
    admin: 0,
    staff: 0,
  };

  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const rawRole = data.role;
    const role: EsteemRole | 'unknown' = isRole(rawRole) ? rawRole : 'unknown';

    const fullName = (data.fullName as string) || 'Unnamed account';
    const email = (data.email as string) || '';
    const displayId =
      role === 'student'
        ? (data.studentId as string) || ''
        : (data.staffId as string) || '';

    const isActive = data.isActive !== false;
    const neverSignedIn = data.mustChangePassword === true;

    const subjects = Array.isArray(data.subjects)
      ? (data.subjects as string[]).filter(Boolean)
      : [];
    const formClasses = Array.isArray(data.formClasses)
      ? (data.formClasses as string[]).filter(Boolean)
      : [];

    const dashboardAccess =
      role === 'admin' ? true : role === 'staff' ? data.dashboardAccess !== false : null;

    const scope = permissionScope(role, data.permissions);

    // ── Mirror document check (the dual-write invariant) ──
    let mirrored = true;
    if (role === 'student') {
      mirrored = displayId ? studentDocIds.has(displayId) : false;
    } else if (role === 'teacher' || role === 'admin' || role === 'staff') {
      mirrored = displayId ? staffDocIds.has(displayId) : false;
    }
    if (!mirrored) missingMirror.push(`${fullName}${displayId ? ` (${displayId})` : ''}`);

    // ── Other checks ──
    if (role === 'unknown') noRole.push(fullName);
    if (data.schoolId && data.schoolId !== SCHOOL_ID) {
      wrongSchool.push(`${fullName} → ${String(data.schoolId)}`);
    }

    if (role === 'student') {
      const classId = data.classId as string | undefined;
      if (!classId) studentNoClass.push(fullName);
      else if (!classIds.has(classId)) studentBadClass.push(`${fullName} → ${classId}`);
    }

    if (role === 'teacher') {
      const subjectIds = Array.isArray(data.subjectIds) ? data.subjectIds : [];
      if (subjectIds.length === 0 && subjects.length === 0) teacherNoSubjects.push(fullName);
    }

    if ((role === 'admin' || role === 'staff') && dashboardAccess && scope === 0) {
      dashboardNoPermissions.push(`${fullName}${displayId ? ` (${displayId})` : ''}`);
    }

    if (displayId) {
      seenDisplayIds.set(displayId, [...(seenDisplayIds.get(displayId) || []), fullName]);
      if (role !== 'unknown') {
        highestIssued[role] = Math.max(highestIssued[role], idNumber(displayId, role));
      }
    }

    users.push({
      uid: docSnap.id,
      fullName,
      email,
      role,
      displayId,
      isActive,
      neverSignedIn,
      createdAt: toIso(data.createdAt),
      className: (data.className as string) || null,
      position: positionOf(role, data),
      subjects,
      formClasses,
      dashboardAccess,
      permissionScope: scope,
      accessLevel: (data.accessLevel as string) || null,
      mirrored,
      photoURL: (data.photoURL as string) || null,
    });
  }

  // ── Orphaned mirrors: a students/ or staff/ doc pointing at no live user ──
  const liveUids = new Set(users.map((u) => u.uid));
  const orphanMirrors: string[] = [];
  for (const [mirrorId, ownerUid] of mirrorOwners) {
    if (!ownerUid || !liveUids.has(ownerUid)) orphanMirrors.push(mirrorId);
  }

  // ── Duplicate IDs ──
  const duplicateIds: string[] = [];
  for (const [displayId, names] of seenDisplayIds) {
    if (names.length > 1) duplicateIds.push(`${displayId} — ${names.join(', ')}`);
  }

  // ── Counter reconciliation ──
  const counterData = counterSnap.exists ? (counterSnap.data() as Record<string, number>) : {};
  const counters: CounterState[] = (Object.keys(ID_PREFIX) as EsteemRole[]).map((role) => {
    const counter = Number(counterData[COUNTER_KEY[role]] ?? 0);
    return {
      role,
      counter,
      highestIssued: highestIssued[role],
      willCollide: counter < highestIssued[role],
    };
  });

  const issues = buildIssues({
    missingMirror,
    orphanMirrors,
    duplicateIds,
    noRole,
    studentNoClass,
    studentBadClass,
    teacherNoSubjects,
    dashboardNoPermissions,
    wrongSchool,
    counters,
    counterExists: counterSnap.exists,
  });

  const counts = {
    total: users.length,
    student: users.filter((u) => u.role === 'student').length,
    teacher: users.filter((u) => u.role === 'teacher').length,
    admin: users.filter((u) => u.role === 'admin').length,
    staff: users.filter((u) => u.role === 'staff').length,
    deactivated: users.filter((u) => !u.isActive).length,
    neverSignedIn: users.filter((u) => u.neverSignedIn).length,
    noDashboardAccess: users.filter((u) => u.dashboardAccess === false).length,
  };

  users.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return { users, counts, counters, issues, fetchedAt: new Date().toISOString() };
}

/* ─────────────────────── issue construction ─────────────────────── */

function buildIssues(input: {
  missingMirror: string[];
  orphanMirrors: string[];
  duplicateIds: string[];
  noRole: string[];
  studentNoClass: string[];
  studentBadClass: string[];
  teacherNoSubjects: string[];
  dashboardNoPermissions: string[];
  wrongSchool: string[];
  counters: CounterState[];
  counterExists: boolean;
}): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  const colliding = input.counters.filter((c) => c.willCollide);
  if (colliding.length > 0) {
    issues.push({
      code: 'counter-behind',
      severity: 'critical',
      title: 'ID counter is behind the highest issued ID',
      detail:
        'The next account created for these roles would be given an ID that already exists. Raise the counter in systemCounters/school_esteem before anyone creates a user.',
      affected: colliding.map(
        (c) => `${c.role}: counter ${c.counter}, highest issued ${c.highestIssued}`,
      ),
      affectedCount: colliding.length,
    });
  }

  if (!input.counterExists) {
    issues.push({
      code: 'counter-missing',
      severity: 'critical',
      title: 'systemCounters document is missing',
      detail:
        'CreateUser.js will start counting from zero and reissue IDs that are already in use.',
      affected: ['systemCounters/school_esteem'],
      affectedCount: 1,
    });
  }

  if (input.duplicateIds.length > 0) {
    issues.push({
      code: 'duplicate-id',
      severity: 'critical',
      title: 'Two accounts share an ID',
      detail:
        'Student and staff IDs key the mirror documents, so a duplicate means one record is overwriting the other.',
      affected: cap(input.duplicateIds),
      affectedCount: input.duplicateIds.length,
    });
  }

  if (input.missingMirror.length > 0) {
    issues.push({
      code: 'missing-mirror',
      severity: 'warn',
      title: 'Accounts with no matching students/ or staff/ record',
      detail:
        'CreateUser.js writes both documents. Anything listed here will be invisible to the Teachers and Students modules, which read the mirror collection.',
      affected: cap(input.missingMirror),
      affectedCount: input.missingMirror.length,
    });
  }

  if (input.orphanMirrors.length > 0) {
    issues.push({
      code: 'orphan-mirror',
      severity: 'warn',
      title: 'Mirror records pointing at a deleted account',
      detail:
        'These students/ or staff/ documents reference a user that no longer exists. They will still appear in module lists.',
      affected: cap(input.orphanMirrors),
      affectedCount: input.orphanMirrors.length,
    });
  }

  if (input.dashboardNoPermissions.length > 0) {
    issues.push({
      code: 'no-permissions',
      severity: 'warn',
      title: 'Dashboard access granted with no modules ticked',
      detail:
        'These people can sign in to the admin dashboard and will see nothing. Either assign permissions or turn dashboard access off.',
      affected: cap(input.dashboardNoPermissions),
      affectedCount: input.dashboardNoPermissions.length,
    });
  }

  if (input.studentBadClass.length > 0) {
    issues.push({
      code: 'bad-class',
      severity: 'warn',
      title: 'Students assigned to a class that no longer exists',
      detail: 'Attendance, timetable and report cards will not resolve for these students.',
      affected: cap(input.studentBadClass),
      affectedCount: input.studentBadClass.length,
    });
  }

  if (input.studentNoClass.length > 0) {
    issues.push({
      code: 'no-class',
      severity: 'warn',
      title: 'Students with no class set',
      detail: 'They will not appear on any register.',
      affected: cap(input.studentNoClass),
      affectedCount: input.studentNoClass.length,
    });
  }

  if (input.teacherNoSubjects.length > 0) {
    issues.push({
      code: 'no-subjects',
      severity: 'info',
      title: 'Teachers with no subjects assigned',
      detail:
        'Expected for new starters and non-teaching roles; a problem if they are meant to be timetabled.',
      affected: cap(input.teacherNoSubjects),
      affectedCount: input.teacherNoSubjects.length,
    });
  }

  if (input.noRole.length > 0) {
    issues.push({
      code: 'no-role',
      severity: 'warn',
      title: 'Accounts with no recognised role',
      detail:
        'Role must be student, teacher, admin or staff. Anything else falls through every permission check.',
      affected: cap(input.noRole),
      affectedCount: input.noRole.length,
    });
  }

  if (input.wrongSchool.length > 0) {
    issues.push({
      code: 'wrong-school',
      severity: 'warn',
      title: 'Accounts tagged to a different school ID',
      detail: `Expected ${SCHOOL_ID}. These will be filtered out of any school-scoped query.`,
      affected: cap(input.wrongSchool),
      affectedCount: input.wrongSchool.length,
    });
  }

  const order = { critical: 0, warn: 1, info: 2 } as const;
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}