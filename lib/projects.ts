// src/lib/projects.ts

import {
  Boxes,
  Building2,
  Cpu,
  Factory,
  GraduationCap,
  HeartPulse,
  Landmark,
  LayoutDashboard,
  ShoppingBag,
  Smartphone,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";

import { db } from "./firebase";

export const PROJECTS_COLLECTION = "projects";

const FIRESTORE_TIMEOUT_MS = 15_000;

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

export const PROJECT_ICONS = {
  factory: {
    label: "Factory",
    icon: Factory,
  },

  building: {
    label: "Building",
    icon: Building2,
  },

  graduation: {
    label: "Education",
    icon: GraduationCap,
  },

  smartphone: {
    label: "Mobile",
    icon: Smartphone,
  },

  dashboard: {
    label: "Dashboard",
    icon: LayoutDashboard,
  },

  truck: {
    label: "Logistics",
    icon: Truck,
  },

  boxes: {
    label: "Inventory",
    icon: Boxes,
  },

  shopping: {
    label: "Retail",
    icon: ShoppingBag,
  },

  health: {
    label: "Health",
    icon: HeartPulse,
  },

  bank: {
    label: "Finance",
    icon: Landmark,
  },

  cpu: {
    label: "AI & data",
    icon: Cpu,
  },

  wrench: {
    label: "Operations",
    icon: Wrench,
  },
} as const;

export type IconKey = keyof typeof PROJECT_ICONS;

export function iconFor(
  key: string | undefined,
): LucideIcon {
  if (key && key in PROJECT_ICONS) {
    return PROJECT_ICONS[key as IconKey].icon;
  }

  return LayoutDashboard;
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ProjectImage = {
  id: string;
  url: string;
  publicId: string;
  label: string;
  alt: string;
  width: number;
  height: number;
};

export type Project = {
  id: string;

  slug: string;
  title: string;
  client: string;
  category: string;
  status: string;
  description: string;

  features: string[];

  iconKey: IconKey;

  images: ProjectImage[];

  order: number;
  published: boolean;

  /*
    Optional live demo.

    Example:
      demoEnabled: true
      demoUrl: "https://esteem-demo.vercel.app"
  */
  demoEnabled: boolean;
  demoUrl: string;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ProjectDraft = Omit<
  Project,
  "id" | "createdAt" | "updatedAt"
>;

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

export const STATUS_OPTIONS = [
  "Live client platform",
  "Platform build",
  "In development",
  "Platform concept",
  "Case study",
];

/* -------------------------------------------------------------------------- */
/* Empty project                                                              */
/* -------------------------------------------------------------------------- */

export function emptyProject(
  order = 0,
): ProjectDraft {
  return {
    slug: "",
    title: "",
    client: "",
    category: "",
    status: STATUS_OPTIONS[0],
    description: "",

    features: [],

    iconKey: "dashboard",

    images: [],

    order,

    published: false,

    demoEnabled: false,
    demoUrl: "",
  };
}

/* -------------------------------------------------------------------------- */
/* Slug                                                                       */
/* -------------------------------------------------------------------------- */

export function slugify(
  value: string,
) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* -------------------------------------------------------------------------- */
/* Cloudinary URL helpers                                                     */
/* -------------------------------------------------------------------------- */

function transform(
  url: string,
  transformation: string,
) {
  if (
    !url ||
    !url.includes("/upload/")
  ) {
    return url;
  }

  return url.replace(
    "/upload/",
    `/upload/${transformation}/`,
  );
}

export const cldThumb = (
  url: string,
) =>
  transform(
    url,
    "w_240,h_168,c_fill,f_auto,q_auto",
  );

export const cldCover = (
  url: string,
) =>
  transform(
    url,
    "w_1000,h_750,c_fill,f_auto,q_auto",
  );

export const cldFull = (
  url: string,
) =>
  transform(
    url,
    "w_1600,c_limit,f_auto,q_auto",
  );

/* -------------------------------------------------------------------------- */
/* Firestore error helpers                                                    */
/* -------------------------------------------------------------------------- */

function readableFirestoreError(
  error: unknown,
) {
  if (!(error instanceof Error)) {
    return "Unknown Firestore error";
  }

  const maybeFirebaseError =
    error as Error & {
      code?: string;
    };

  const code =
    maybeFirebaseError.code ?? "";

  switch (code) {
    case "permission-denied":
    case "firestore/permission-denied":
      return (
        "Firestore denied this request. " +
        "Check your Firestore security rules."
      );

    case "unauthenticated":
    case "firestore/unauthenticated":
      return (
        "You are not authenticated. " +
        "Sign in again and retry."
      );

    case "unavailable":
    case "firestore/unavailable":
      return (
        "Firestore is currently unavailable. " +
        "Check your internet connection and retry."
      );

    case "deadline-exceeded":
    case "firestore/deadline-exceeded":
      return (
        "Firestore took too long to respond. " +
        "Please retry."
      );

    case "failed-precondition":
    case "firestore/failed-precondition":
      return (
        "Firestore could not complete the request. " +
        maybeFirebaseError.message
      );

    default:
      return (
        maybeFirebaseError.message ||
        "Firestore request failed."
      );
  }
}

/*
  Prevent a Firestore operation from leaving the UI waiting indefinitely.

  Since project creation uses the slug as the document ID, retrying the same
  create operation cannot produce multiple random duplicate documents.
*/

function firestoreTimeout<T>(
  operation: Promise<T>,
  label: string,
  timeout = FIRESTORE_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>(
    (resolve, reject) => {
      let settled = false;

      const timer = setTimeout(
        () => {
          if (settled) {
            return;
          }

          settled = true;

          console.error(
            `[projects] ${label} timed out after ${timeout}ms`,
          );

          reject(
            new Error(
              `${label} took too long. Firestore did not respond. Check your internet connection, Firebase configuration and Firestore rules.`,
            ),
          );
        },
        timeout,
      );

      operation.then(
        (result) => {
          if (settled) {
            return;
          }

          settled = true;

          clearTimeout(timer);

          resolve(result);
        },

        (error: unknown) => {
          if (settled) {
            return;
          }

          settled = true;

          clearTimeout(timer);

          console.error(
            `[projects] ${label} failed:`,
            error,
          );

          reject(
            new Error(
              readableFirestoreError(error),
            ),
          );
        },
      );
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Firestore parser                                                          */
/* -------------------------------------------------------------------------- */

function fromDoc(
  id: string,
  data: Record<string, unknown>,
): Project {
  return {
    id,

    slug:
      typeof data.slug === "string"
        ? data.slug
        : "",

    title:
      typeof data.title === "string"
        ? data.title
        : "Untitled project",

    client:
      typeof data.client === "string"
        ? data.client
        : "",

    category:
      typeof data.category === "string"
        ? data.category
        : "",

    status:
      typeof data.status === "string"
        ? data.status
        : "",

    description:
      typeof data.description === "string"
        ? data.description
        : "",

    features: Array.isArray(data.features)
      ? (data.features as unknown[]).filter(
          (value): value is string =>
            typeof value === "string",
        )
      : [],

    iconKey:
      typeof data.iconKey === "string" &&
      data.iconKey in PROJECT_ICONS
        ? (data.iconKey as IconKey)
        : "dashboard",

    images: Array.isArray(data.images)
      ? (data.images as ProjectImage[])
      : [],

    order:
      typeof data.order === "number"
        ? data.order
        : 0,

    published: Boolean(
      data.published,
    ),

    /*
      Backwards-compatible defaults.

      Existing project documents that were created before the live-demo
      feature was added will simply behave as though demos are disabled.
    */
    demoEnabled: Boolean(
      data.demoEnabled,
    ),

    demoUrl:
      typeof data.demoUrl === "string"
        ? data.demoUrl
        : "",

    createdAt:
      data.createdAt as Timestamp | undefined,

    updatedAt:
      data.updatedAt as Timestamp | undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* Query                                                                      */
/* -------------------------------------------------------------------------- */

const orderedQuery = () =>
  query(
    collection(
      db,
      PROJECTS_COLLECTION,
    ),
    orderBy("order", "asc"),
  );

/* -------------------------------------------------------------------------- */
/* Fetch                                                                      */
/* -------------------------------------------------------------------------- */

export async function fetchProjects(
  {
    publishedOnly = true,
  }: {
    publishedOnly?: boolean;
  } = {},
): Promise<Project[]> {
  try {
    console.log(
      "[projects] Fetching projects...",
    );

    const snap =
      await firestoreTimeout(
        getDocs(
          orderedQuery(),
        ),
        "Loading projects",
      );

    const all =
      snap.docs.map(
        (item) =>
          fromDoc(
            item.id,
            item.data(),
          ),
      );

    console.log(
      `[projects] Loaded ${all.length} project(s)`,
    );

    if (!publishedOnly) {
      return all;
    }

    return all.filter(
      (project) =>
        project.published,
    );
  } catch (error) {
    console.error(
      "[projects] fetchProjects failed:",
      error,
    );

    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Live subscription                                                          */
/* -------------------------------------------------------------------------- */

export function subscribeProjects(
  next: (
    projects: Project[],
  ) => void,

  onError?: (
    error: Error,
  ) => void,
) {
  console.log(
    "[projects] Opening Firestore subscription...",
  );

  return onSnapshot(
    orderedQuery(),

    (snapshot) => {
      const projects =
        snapshot.docs.map(
          (item) =>
            fromDoc(
              item.id,
              item.data(),
            ),
        );

      console.log(
        `[projects] Snapshot received: ${projects.length} project(s)`,
      );

      next(projects);
    },

    (error) => {
      console.error(
        "[projects] Firestore subscription failed:",
        error,
      );

      onError?.(
        new Error(
          readableFirestoreError(
            error,
          ),
        ),
      );
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createProject(
  draft: ProjectDraft,
): Promise<string> {
  const cleanSlug =
    slugify(
      draft.slug ||
        draft.title,
    );

  if (!cleanSlug) {
    throw new Error(
      "The project needs a valid title and slug.",
    );
  }

  const cleanDemoUrl =
    draft.demoUrl.trim();

  if (
    draft.demoEnabled &&
    !cleanDemoUrl
  ) {
    throw new Error(
      "A live demo URL is required when live demo is enabled.",
    );
  }

  const projectRef = doc(
    db,
    PROJECTS_COLLECTION,
    cleanSlug,
  );

  console.log(
    "[projects] Creating project:",
    {
      id: projectRef.id,
      slug: cleanSlug,
      title: draft.title,
      images:
        draft.images.length,
      features:
        draft.features.length,
      published:
        draft.published,
      demoEnabled:
        draft.demoEnabled,
      demoUrl:
        cleanDemoUrl,
    },
  );

  try {
    await firestoreTimeout(
      setDoc(
        projectRef,
        {
          ...draft,

          slug:
            cleanSlug,

          demoEnabled:
            Boolean(
              draft.demoEnabled,
            ),

          demoUrl:
            cleanDemoUrl,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      ),

      `Creating project "${draft.title}"`,
    );

    console.log(
      `[projects] Created project successfully: ${projectRef.id}`,
    );

    return projectRef.id;
  } catch (error) {
    console.error(
      `[projects] Could not create "${draft.title}":`,
      error,
    );

    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function saveProject(
  id: string,
  draft: Partial<ProjectDraft>,
): Promise<void> {
  if (!id) {
    throw new Error(
      "Cannot save project: project ID is missing.",
    );
  }

  const projectRef = doc(
    db,
    PROJECTS_COLLECTION,
    id,
  );

  /*
    Only normalise demoUrl when it is actually part of this update.

    This matters because saveProject is also used for small updates such as:
      { published: true }
      { order: 2 }

    We do not want those operations accidentally overwriting demo fields.
  */
  const payload: Partial<ProjectDraft> & {
    updatedAt: ReturnType<
      typeof serverTimestamp
    >;
  } = {
    ...draft,
    updatedAt:
      serverTimestamp(),
  };

  if (
    typeof draft.demoUrl ===
    "string"
  ) {
    payload.demoUrl =
      draft.demoUrl.trim();
  }

  if (
    typeof draft.demoEnabled ===
    "boolean"
  ) {
    payload.demoEnabled =
      draft.demoEnabled;
  }

  console.log(
    `[projects] Updating project ${id}:`,
    Object.keys(draft),
  );

  try {
    await firestoreTimeout(
      updateDoc(
        projectRef,
        payload,
      ),

      `Updating project "${id}"`,
    );

    console.log(
      `[projects] Updated project successfully: ${id}`,
    );
  } catch (error) {
    console.error(
      `[projects] Could not update ${id}:`,
      error,
    );

    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function removeProject(
  id: string,
): Promise<void> {
  if (!id) {
    throw new Error(
      "Cannot delete project: project ID is missing.",
    );
  }

  console.log(
    `[projects] Deleting project ${id}...`,
  );

  try {
    await firestoreTimeout(
      deleteDoc(
        doc(
          db,
          PROJECTS_COLLECTION,
          id,
        ),
      ),

      `Deleting project "${id}"`,
    );

    console.log(
      `[projects] Deleted project successfully: ${id}`,
    );
  } catch (error) {
    console.error(
      `[projects] Could not delete ${id}:`,
      error,
    );

    throw error;
  }
}