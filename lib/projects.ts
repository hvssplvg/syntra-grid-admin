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
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";

import { db } from "./firebase";

export const PROJECTS_COLLECTION = "projects";

/* ── icons ────────────────────────────────────────────────────────────────
   A component can't be stored in Firestore, so the doc holds a key and we
   resolve it here. Add to this map to offer more choices in the admin. */
export const PROJECT_ICONS = {
  factory: { label: "Factory", icon: Factory },
  building: { label: "Building", icon: Building2 },
  graduation: { label: "Education", icon: GraduationCap },
  smartphone: { label: "Mobile", icon: Smartphone },
  dashboard: { label: "Dashboard", icon: LayoutDashboard },
  truck: { label: "Logistics", icon: Truck },
  boxes: { label: "Inventory", icon: Boxes },
  shopping: { label: "Retail", icon: ShoppingBag },
  health: { label: "Health", icon: HeartPulse },
  bank: { label: "Finance", icon: Landmark },
  cpu: { label: "AI & data", icon: Cpu },
  wrench: { label: "Operations", icon: Wrench },
} as const;

export type IconKey = keyof typeof PROJECT_ICONS;

export function iconFor(key: string | undefined): LucideIcon {
  return PROJECT_ICONS[(key as IconKey) ?? "dashboard"]?.icon ?? LayoutDashboard;
}

/* ── types ─────────────────────────────────────────────────────────────── */

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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ProjectDraft = Omit<Project, "id" | "createdAt" | "updatedAt">;

export const STATUS_OPTIONS = [
  "Live client platform",
  "Platform build",
  "In development",
  "Platform concept",
  "Case study",
];

export function emptyProject(order = 0): ProjectDraft {
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
  };
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/* ── Cloudinary URL helpers ───────────────────────────────────────────────
   Cloudinary resizes on delivery, so we never ship a 3MB screenshot into a
   200px thumbnail. f_auto serves AVIF/WebP where the browser supports it. */
function transform(url: string, t: string) {
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/${t}/`);
}

export const cldThumb = (url: string) =>
  transform(url, "w_240,h_168,c_fill,f_auto,q_auto");

export const cldCover = (url: string) =>
  transform(url, "w_1000,h_750,c_fill,f_auto,q_auto");

export const cldFull = (url: string) =>
  transform(url, "w_1600,c_limit,f_auto,q_auto");

/* ── Firestore ────────────────────────────────────────────────────────── */

function fromDoc(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    slug: (data.slug as string) ?? "",
    title: (data.title as string) ?? "Untitled project",
    client: (data.client as string) ?? "",
    category: (data.category as string) ?? "",
    status: (data.status as string) ?? "",
    description: (data.description as string) ?? "",
    features: (data.features as string[]) ?? [],
    iconKey: (data.iconKey as IconKey) ?? "dashboard",
    images: (data.images as ProjectImage[]) ?? [],
    order: (data.order as number) ?? 0,
    published: Boolean(data.published),
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
  };
}

const orderedQuery = () =>
  query(collection(db, PROJECTS_COLLECTION), orderBy("order", "asc"));

/* One-shot read for the public page. Published filtering happens in memory
   so you don't need a composite index for (published, order). */
export async function fetchProjects({ publishedOnly = true } = {}) {
  const snap = await getDocs(orderedQuery());
  const all = snap.docs.map((d) => fromDoc(d.id, d.data()));
  return publishedOnly ? all.filter((p) => p.published) : all;
}

/* Live read for the admin. */
export function subscribeProjects(
  next: (projects: Project[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    orderedQuery(),
    (snap) => next(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    (err) => onError?.(err),
  );
}

export async function createProject(draft: ProjectDraft) {
  const ref = await addDoc(collection(db, PROJECTS_COLLECTION), {
    ...draft,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveProject(id: string, draft: Partial<ProjectDraft>) {
  await updateDoc(doc(db, PROJECTS_COLLECTION, id), {
    ...draft,
    updatedAt: serverTimestamp(),
  });
}

export async function removeProject(id: string) {
  await deleteDoc(doc(db, PROJECTS_COLLECTION, id));
}