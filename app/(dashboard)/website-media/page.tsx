/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/static-components */
"use client";

/*
  Admin → Projects.

  Put this at  src/app/admin/projects/page.tsx  (or keep your existing
  website-media route and drop it there instead).

  Everything the public projects page renders is created here: the copy, the
  icon, the feature list, the ordering, and as many screenshots as you like.
  Images upload to Cloudinary the moment you drop them; the project record —
  including the image list — saves to Firestore when you hit Save.
*/

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  Loader2,
  Plus,
  Star,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import {
  MAX_FILE_MB,
  cloudinaryReady,
  requestCloudinaryDelete,
  uploadToCloudinary,
} from "@/lib/cloudinary";
import {
  PROJECT_ICONS,
  STATUS_OPTIONS,
  cldThumb,
  createProject,
  emptyProject,
  iconFor,
  removeProject,
  saveProject,
  slugify,
  subscribeProjects,
  type IconKey,
  type Project,
  type ProjectDraft,
  type ProjectImage,
} from "@/lib/projects";

const display = "var(--font-display,'Space_Grotesk',system-ui,sans-serif)";
const mono = "var(--font-mono,ui-monospace,monospace)";
const goldBg = "linear-gradient(100deg,#F3DFA2,#D4AF37 55%,#C79A2A)";

const uid = () => Math.random().toString(36).slice(2, 10);

type Toast = { id: string; tone: "ok" | "error"; message: string };
type Editing = { id: string | null; draft: ProjectDraft };

/* ── page ─────────────────────────────────────────────────────────────── */

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((tone: Toast["tone"], message: string) => {
    const id = uid();
    setToasts((t) => [...t, { id, tone, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  useEffect(() => {
    return subscribeProjects(
      (list) => {
        setProjects(list);
        setLoading(false);
        setLoadError(null);
      },
      (err) => {
        setLoading(false);
        setLoadError(err.message);
      },
    );
  }, []);

  const startNew = () =>
    setEditing({ id: null, draft: emptyProject(projects.length) });

  const startEdit = (project: Project) => {
    const { id, createdAt, updatedAt, ...draft } = project;
    void id;
    void createdAt;
    void updatedAt;
    setEditing({ id: project.id, draft });
  };

  const handleSave = async (draft: ProjectDraft, id: string | null) => {
    const clean: ProjectDraft = {
      ...draft,
      slug: draft.slug || slugify(draft.title),
      features: draft.features.map((f) => f.trim()).filter(Boolean),
    };

    if (!clean.title.trim()) {
      notify("error", "Give the project a title first");
      return;
    }

    const clash = projects.some((p) => p.slug === clean.slug && p.id !== id);
    if (clash) {
      notify("error", `The slug "${clean.slug}" is already used`);
      return;
    }

    try {
      if (id) await saveProject(id, clean);
      else await createProject(clean);
      setEditing(null);
      notify("ok", id ? "Project updated" : "Project created");
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Could not save");
    }
  };

  const handleDelete = async (project: Project) => {
    const ok = window.confirm(
      `Delete "${project.title}" and its ${project.images.length} image${
        project.images.length === 1 ? "" : "s"
      }? This can't be undone.`,
    );
    if (!ok) return;

    try {
      await Promise.all(
        project.images.map((img) => requestCloudinaryDelete(img.publicId)),
      );
      await removeProject(project.id);
      notify("ok", "Project deleted");
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Could not delete");
    }
  };

  const togglePublished = async (project: Project) => {
    try {
      await saveProject(project.id, { published: !project.published });
      notify("ok", project.published ? "Moved to draft" : "Published");
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Could not update");
    }
  };

  /* Order is a plain number, so moving a project is a swap of two values. */
  const move = async (index: number, dir: -1 | 1) => {
    const a = projects[index];
    const b = projects[index + dir];
    if (!a || !b) return;

    try {
      await Promise.all([
        saveProject(a.id, { order: b.order }),
        saveProject(b.id, { order: a.order }),
      ]);
    } catch {
      notify("error", "Could not reorder");
    }
  };

  const publishedCount = useMemo(
    () => projects.filter((p) => p.published).length,
    [projects],
  );

  return (
    <main className="min-h-screen bg-[#FBFAF6] px-4 py-8 text-[#0B1020] sm:px-6 md:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A87B1B]"
              style={{ fontFamily: mono }}
            >
              Content
            </p>
            <h1
              className="mt-2 text-[2rem] font-bold tracking-[-0.04em] md:text-[2.5rem]"
              style={{ fontFamily: display }}
            >
              Projects
            </h1>
            <p className="mt-2 max-w-2xl leading-7 text-[#5A6173]">
              Everything on the public work page is managed here. Published
              projects appear in the order shown below.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="rounded-full border border-[#EFE3BE] bg-white px-4 py-2 text-sm text-[#5A6173]"
              style={{ fontFamily: mono }}
            >
              {publishedCount} live · {projects.length - publishedCount} draft
            </span>

            <button
              type="button"
              onClick={startNew}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-sm font-semibold text-[#241A05] shadow-[0_10px_30px_-12px_rgba(212,175,55,0.6)] transition hover:brightness-[1.03]"
              style={{ background: goldBg, fontFamily: display }}
            >
              <Plus size={16} strokeWidth={2.4} />
              New project
            </button>
          </div>
        </header>

        {!cloudinaryReady && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#F0D6A8] bg-[#FFFBEF] p-4 text-sm text-[#7A5A12]">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>
              Cloudinary isn&rsquo;t configured, so image uploads are disabled.
              Set <code className="font-semibold">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code>{" "}
              in <code className="font-semibold">.env.local</code> and restart
              the dev server.
            </p>
          </div>
        )}

        <section className="mt-8 grid gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-2xl border border-[#EFE3BE] bg-white"
              />
            ))
          ) : loadError ? (
            <Empty
              icon={AlertCircle}
              title="Couldn't load projects"
              body={loadError}
            />
          ) : projects.length === 0 ? (
            <Empty
              icon={ImageIcon}
              title="No projects yet"
              body="Create your first one — add the copy, pick an icon, then drop in as many screenshots as you want."
            />
          ) : (
            projects.map((project, i) => (
              <ProjectRow
                key={project.id}
                project={project}
                first={i === 0}
                last={i === projects.length - 1}
                onEdit={() => startEdit(project)}
                onDelete={() => handleDelete(project)}
                onToggle={() => togglePublished(project)}
                onMove={(dir) => move(i, dir)}
              />
            ))
          )}
        </section>
      </div>

      {editing && (
        <ProjectEditor
          key={editing.id ?? "new"}
          initial={editing.draft}
          isNew={!editing.id}
          onCancel={() => setEditing(null)}
          onSave={(draft) => handleSave(draft, editing.id)}
          notify={notify}
        />
      )}

      <Toasts toasts={toasts} />
    </main>
  );
}

/* ── list row ─────────────────────────────────────────────────────────── */

function ProjectRow({
  project,
  first,
  last,
  onEdit,
  onDelete,
  onToggle,
  onMove,
}: {
  project: Project;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const Icon = iconFor(project.iconKey);
  const cover = project.images[0];

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-[#EFE3BE] bg-white p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="hidden flex-col gap-1 text-[#C6CBD6] sm:flex">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={first}
          aria-label="Move up"
          className="rounded p-1 transition hover:text-[#0B1020] disabled:opacity-30"
        >
          <ArrowLeft size={14} className="rotate-90" />
        </button>
        <GripVertical size={14} />
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={last}
          aria-label="Move down"
          className="rounded p-1 transition hover:text-[#0B1020] disabled:opacity-30"
        >
          <ArrowRight size={14} className="rotate-90" />
        </button>
      </div>

      <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl border border-[#EFE3BE] bg-[#0B1020] sm:h-20 sm:w-28">
        {cover ? (
          <img
            src={cldThumb(cover.url)}
            alt={cover.alt || project.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[#F3DFA2]/70">
            <Icon size={20} strokeWidth={1.8} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            className="text-lg font-bold tracking-[-0.03em]"
            style={{ fontFamily: display }}
          >
            {project.title}
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              project.published
                ? "bg-[#ECFBF4] text-[#0F7A55]"
                : "bg-[#F4F2EC] text-[#7A8191]"
            }`}
          >
            {project.published ? "Live" : "Draft"}
          </span>
        </div>

        <p
          className="mt-1 truncate text-xs text-[#7A8191]"
          style={{ fontFamily: mono }}
        >
          {[project.client, project.category, `/${project.slug}`]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#5A6173]">
          {project.description || "No description yet."}
        </p>

        <p className="mt-2 text-xs text-[#9CA3AF]">
          {project.images.length} image
          {project.images.length === 1 ? "" : "s"} · {project.features.length}{" "}
          feature{project.features.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={project.published ? "Move to draft" : "Publish"}
          title={project.published ? "Move to draft" : "Publish"}
          className="grid h-10 w-10 place-items-center rounded-full border border-[#EFE3BE] text-[#5A6173] transition hover:bg-[#FBFAF6] hover:text-[#0B1020]"
        >
          {project.published ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>

        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete project"
          title="Delete project"
          className="grid h-10 w-10 place-items-center rounded-full border border-[#EFE3BE] text-[#B4423A] transition hover:bg-[#FFF4F3]"
        >
          <Trash2 size={16} />
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="min-h-[40px] rounded-full border border-[#EFE3BE] px-5 text-sm font-semibold transition hover:border-[#D4AF37] hover:bg-[#FFFBEF] hover:text-[#A87B1B]"
          style={{ fontFamily: display }}
        >
          Edit
        </button>
      </div>
    </article>
  );
}

/* ── editor ───────────────────────────────────────────────────────────── */

type Upload = { id: string; name: string; progress: number; error?: string };

function ProjectEditor({
  initial,
  isNew,
  onCancel,
  onSave,
  notify,
}: {
  initial: ProjectDraft;
  isNew: boolean;
  onCancel: () => void;
  onSave: (draft: ProjectDraft) => Promise<void>;
  notify: (tone: "ok" | "error", message: string) => void;
}) {
  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /* Slug follows the title until you edit it by hand. */
  const setTitle = (title: string) =>
    setDraft((d) => ({
      ...d,
      title,
      slug: slugTouched ? d.slug : slugify(title),
    }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  const addFiles = async (files: FileList | File[]) => {
    if (!cloudinaryReady) {
      notify("error", "Cloudinary isn't configured");
      return;
    }

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        notify("error", `${file.name} is over ${MAX_FILE_MB}MB`);
        continue;
      }

      const taskId = uid();
      setUploads((u) => [...u, { id: taskId, name: file.name, progress: 0 }]);

      try {
        const res = await uploadToCloudinary(file, (p) =>
          setUploads((u) =>
            u.map((t) => (t.id === taskId ? { ...t, progress: p } : t)),
          ),
        );

        const image: ProjectImage = {
          id: uid(),
          url: res.secure_url,
          publicId: res.public_id,
          label: res.original_filename ?? file.name,
          alt: "",
          width: res.width ?? 0,
          height: res.height ?? 0,
        };

        setDraft((d) => ({ ...d, images: [...d.images, image] }));
        setUploads((u) => u.filter((t) => t.id !== taskId));
      } catch (err) {
        setUploads((u) =>
          u.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  error: err instanceof Error ? err.message : "Upload failed",
                }
              : t,
          ),
        );
      }
    }
  };

  const patchImage = (id: string, changes: Partial<ProjectImage>) =>
    setDraft((d) => ({
      ...d,
      images: d.images.map((img) => (img.id === id ? { ...img, ...changes } : img)),
    }));

  const dropImage = (id: string) =>
    setDraft((d) => ({ ...d, images: d.images.filter((img) => img.id !== id) }));

  const moveImage = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const next = [...d.images];
      const target = index + dir;
      if (target < 0 || target >= next.length) return d;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...d, images: next };
    });

  const makeCover = (index: number) =>
    setDraft((d) => {
      const next = [...d.images];
      const [item] = next.splice(index, 1);
      return { ...d, images: [item, ...next] };
    });

  const submit = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  const IconPreview = iconFor(draft.iconKey);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
      <div
        onClick={onCancel}
        className="absolute inset-0 bg-[#0B1020]/70 backdrop-blur-[3px]"
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "New project" : "Edit project"}
        className="relative z-10 flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[1.5rem] border border-[#EFE3BE] bg-white shadow-[0_40px_120px_-30px_rgba(11,16,32,0.55)] sm:max-h-[90dvh] sm:rounded-[1.5rem]"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#F0E8D2] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[#EFE3BE] bg-[#FFFBEF] text-[#A87B1B]">
              <IconPreview size={18} strokeWidth={1.9} />
            </span>
            <h2
              className="text-lg font-bold tracking-[-0.03em]"
              style={{ fontFamily: display }}
            >
              {isNew ? "New project" : draft.title || "Edit project"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full border border-[#EFE3BE] text-[#5A6173] transition hover:bg-[#FBFAF6]"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          {/* details */}
          <SectionTitle>Details</SectionTitle>

          <div className="grid gap-4">
            <Field label="Title">
              <input
                value={draft.title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Distribution & Construction Platform"
                className={inputClass}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client" hint="Shown as “Built for …”. Leave blank to hide.">
                <input
                  value={draft.client}
                  onChange={(e) => set("client", e.target.value)}
                  placeholder="Meldex Industries"
                  className={inputClass}
                />
              </Field>

              <Field label="Category">
                <input
                  value={draft.category}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder="Industrial operations"
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <input
                  list="status-options"
                  value={draft.status}
                  onChange={(e) => set("status", e.target.value)}
                  className={inputClass}
                />
                <datalist id="status-options">
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>

              <Field label="Slug" hint="Used in URLs. Follows the title until you edit it.">
                <input
                  value={draft.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", slugify(e.target.value));
                  }}
                  placeholder="meldex"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
                placeholder="What the platform does and who it's for."
                className={`${inputClass} h-auto py-3 leading-7`}
              />
            </Field>

            <Field label="Icon">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PROJECT_ICONS) as IconKey[]).map((key) => {
                  const { icon: Ico, label } = PROJECT_ICONS[key];
                  const active = draft.iconKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => set("iconKey", key)}
                      title={label}
                      aria-label={label}
                      aria-pressed={active}
                      className={`grid h-11 w-11 place-items-center rounded-xl border transition ${
                        active
                          ? "border-[#D4AF37] bg-[#FFFBEF] text-[#A87B1B]"
                          : "border-[#EFE3BE] text-[#5A6173] hover:border-[#E2D6B0]"
                      }`}
                    >
                      <Ico size={18} strokeWidth={1.9} />
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          {/* features */}
          <SectionTitle className="mt-9">Inside the build</SectionTitle>
          <p className="-mt-3 mb-3 text-sm text-[#7A8191]">
            Short phrases, four works well.
          </p>

          <div className="grid gap-2.5">
            {draft.features.map((feature, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={feature}
                  onChange={(e) => {
                    const next = [...draft.features];
                    next[i] = e.target.value;
                    set("features", next);
                  }}
                  placeholder="Client portal"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "features",
                      draft.features.filter((_, idx) => idx !== i),
                    )
                  }
                  aria-label="Remove feature"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#EFE3BE] text-[#B4423A] transition hover:bg-[#FFF4F3]"
                >
                  <X size={16} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => set("features", [...draft.features, ""])}
              className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-full border border-dashed border-[#DFD3B4] px-4 text-sm font-semibold text-[#A87B1B] transition hover:bg-[#FFFBEF]"
            >
              <Plus size={15} strokeWidth={2.4} />
              Add feature
            </button>
          </div>

          {/* images */}
          <SectionTitle className="mt-9">Screenshots</SectionTitle>
          <p className="-mt-3 mb-3 text-sm text-[#7A8191]">
            The first image is the cover on the work page. Add as many as you
            like — the gallery handles the rest.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              setOver(false);
              if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
            }}
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
              over ? "border-[#D4AF37] bg-[#FFFBEF]" : "border-[#EFE3BE] bg-[#FBFAF6]"
            }`}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#EFE3BE] bg-white text-[#A87B1B]">
              <UploadCloud size={20} strokeWidth={1.9} />
            </div>
            <p className="mt-3 text-sm text-[#5A6173]">
              Drop images here, or
            </p>
            <button
              type="button"
              disabled={!cloudinaryReady}
              onClick={() => inputRef.current?.click()}
              className="mt-3 min-h-[44px] rounded-full border border-[#EFE3BE] bg-white px-5 text-sm font-semibold transition hover:border-[#D4AF37] hover:text-[#A87B1B] disabled:opacity-50"
              style={{ fontFamily: display }}
            >
              Choose files
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                if (e.target.files?.length) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {uploads.length > 0 && (
            <div className="mt-3 grid gap-2">
              {uploads.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-xl border border-[#EFE3BE] bg-white px-4 py-3"
                >
                  {task.error ? (
                    <AlertCircle size={15} className="shrink-0 text-[#B4423A]" />
                  ) : (
                    <Loader2 size={15} className="shrink-0 animate-spin text-[#A87B1B]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.name}</p>
                    {task.error ? (
                      <p className="mt-0.5 text-xs text-[#B4423A]">{task.error}</p>
                    ) : (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F1EBDA]">
                        <div
                          className="h-full rounded-full transition-[width] duration-200"
                          style={{
                            width: `${task.progress}%`,
                            background: "linear-gradient(90deg,#F3DFA2,#D4AF37)",
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-[#7A8191]">
                    {task.error ? "Failed" : `${task.progress}%`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {draft.images.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {draft.images.map((img, i) => (
                <div
                  key={img.id}
                  className="overflow-hidden rounded-2xl border border-[#EFE3BE] bg-white"
                >
                  <div className="relative aspect-[4/3] bg-[#0B1020]">
                    <img
                      src={cldThumb(img.url)}
                      alt={img.alt || img.label}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />

                    {i === 0 && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#D4AF37] px-2.5 py-1 text-[11px] font-semibold text-[#241A05]">
                        <Star size={11} strokeWidth={2.6} /> Cover
                      </span>
                    )}

                    <div className="absolute bottom-2 right-2 flex gap-1.5">
                      <MiniButton
                        label="Move left"
                        onClick={() => moveImage(i, -1)}
                        disabled={i === 0}
                      >
                        <ArrowLeft size={14} />
                      </MiniButton>
                      <MiniButton
                        label="Move right"
                        onClick={() => moveImage(i, 1)}
                        disabled={i === draft.images.length - 1}
                      >
                        <ArrowRight size={14} />
                      </MiniButton>
                      {i !== 0 && (
                        <MiniButton label="Make cover" onClick={() => makeCover(i)}>
                          <Star size={14} />
                        </MiniButton>
                      )}
                      <MiniButton
                        label="Remove image"
                        tone="danger"
                        onClick={() => dropImage(img.id)}
                      >
                        <Trash2 size={14} />
                      </MiniButton>
                    </div>
                  </div>

                  <div className="grid gap-2 p-3">
                    <input
                      value={img.label}
                      onChange={(e) => patchImage(img.id, { label: e.target.value })}
                      placeholder="Caption, e.g. Operations dashboard"
                      className="h-10 w-full rounded-lg border border-[#EFE3BE] px-3 text-sm outline-none focus:border-[#D4AF37]"
                    />
                    <input
                      value={img.alt}
                      onChange={(e) => patchImage(img.id, { alt: e.target.value })}
                      placeholder="Alt text for screen readers"
                      className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-[#D4AF37] ${
                        img.alt ? "border-[#EFE3BE]" : "border-[#F3C9C4] bg-[#FFF9F8]"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#F0E8D2] px-5 py-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => set("published", e.target.checked)}
              className="h-4 w-4 accent-[#D4AF37]"
            />
            Publish to the work page
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] rounded-full px-5 text-sm font-semibold text-[#5A6173] transition hover:text-[#0B1020]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-6 text-sm font-semibold text-[#241A05] shadow-[0_10px_30px_-12px_rgba(212,175,55,0.6)] transition hover:brightness-[1.03] disabled:opacity-60"
              style={{ background: goldBg, fontFamily: display }}
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {isNew ? "Create project" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── bits ─────────────────────────────────────────────────────────────── */

const inputClass =
  "h-11 w-full rounded-xl border border-[#EFE3BE] bg-white px-4 text-sm outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15";

function SectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#A87B1B] ${className}`}
      style={{ fontFamily: mono }}
    >
      {children}
    </p>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#0B1020]">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-[#7A8191]">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function MiniButton({
  children,
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-full bg-white/92 shadow-sm transition hover:bg-white disabled:opacity-40 ${
        tone === "danger" ? "text-[#B4423A]" : "text-[#0B1020]"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ImageIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[#EFE3BE] bg-white px-6 py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#EFE3BE] bg-[#FFFBEF] text-[#A87B1B]">
        <Icon size={24} strokeWidth={1.9} />
      </div>
      <p
        className="mt-4 text-lg font-bold tracking-[-0.02em]"
        style={{ fontFamily: display }}
      >
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-[#5A6173]">
        {body}
      </p>
    </div>
  );
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 rounded-full border px-4 py-3 text-sm font-medium shadow-lg ${
            t.tone === "ok"
              ? "border-[#EFE3BE] bg-white text-[#0B1020]"
              : "border-[#F3C9C4] bg-[#FFF4F3] text-[#B4423A]"
          }`}
        >
          {t.tone === "ok" ? (
            <Check size={15} strokeWidth={2.6} />
          ) : (
            <AlertCircle size={15} />
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}