/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/static-components */
"use client";

/*
  Admin → Projects.

  Everything the public projects page renders is created here:
  copy, icon, feature list, ordering, screenshots and optional
  live demo deployment.

  Images upload to Cloudinary immediately.
  Project metadata saves to Firestore when Save is pressed.
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
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  Loader2,
  MonitorPlay,
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

const display =
  "var(--font-display,'Space_Grotesk',system-ui,sans-serif)";

const mono =
  "var(--font-mono,ui-monospace,monospace)";

const goldBg =
  "linear-gradient(100deg,#F3DFA2,#D4AF37 55%,#C79A2A)";

const uid = () =>
  Math.random().toString(36).slice(2, 10);

const SAVE_TIMEOUT_MS = 15_000;

type Toast = {
  id: string;
  tone: "ok" | "error";
  message: string;
};

type Editing = {
  id: string | null;
  draft: ProjectDraft;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return Promise.race([
    promise,

    new Promise<never>((_, reject) => {
      const timeoutId =
        window.setTimeout(() => {
          reject(
            new Error(message),
          );
        }, ms);

      void promise.finally(() => {
        window.clearTimeout(
          timeoutId,
        );
      });
    }),
  ]);
}

function isValidHttpUrl(
  value: string,
) {
  try {
    const url =
      new URL(value);

    return (
      url.protocol ===
        "http:" ||
      url.protocol ===
        "https:"
    );
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AdminProjectsPage() {
  const [
    projects,
    setProjects,
  ] = useState<Project[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState<
    string | null
  >(null);

  const [
    editing,
    setEditing,
  ] = useState<
    Editing | null
  >(null);

  const [
    toasts,
    setToasts,
  ] = useState<Toast[]>([]);

  const notify = useCallback(
    (
      tone: Toast["tone"],
      message: string,
    ) => {
      const id = uid();

      setToasts(
        (current) => [
          ...current,
          {
            id,
            tone,
            message,
          },
        ],
      );

      window.setTimeout(() => {
        setToasts(
          (current) =>
            current.filter(
              (toast) =>
                toast.id !== id,
            ),
        );
      }, 4000);
    },
    [],
  );

  useEffect(() => {
    console.log(
      "[projects] Starting Firestore subscription",
    );

    const unsubscribe =
      subscribeProjects(
        (list) => {
          console.log(
            `[projects] Subscription received ${list.length} project(s)`,
          );

          setProjects(list);
          setLoading(false);
          setLoadError(null);
        },

        (err) => {
          console.error(
            "[projects] Subscription failed:",
            err,
          );

          setLoading(false);
          setLoadError(
            err.message,
          );
        },
      );

    return unsubscribe;
  }, []);

  const startNew = () => {
    setEditing({
      id: null,
      draft:
        emptyProject(
          projects.length,
        ),
    });
  };

  const startEdit = (
    project: Project,
  ) => {
    const {
      id,
      createdAt,
      updatedAt,
      ...draft
    } = project;

    void id;
    void createdAt;
    void updatedAt;

    setEditing({
      id: project.id,
      draft,
    });
  };

  const handleSave = async (
    draft: ProjectDraft,
    id: string | null,
  ) => {
    const clean: ProjectDraft =
      {
        ...draft,

        title:
          draft.title.trim(),

        client:
          draft.client.trim(),

        category:
          draft.category.trim(),

        status:
          draft.status.trim(),

        description:
          draft.description.trim(),

        slug: draft.slug
          ? slugify(
              draft.slug,
            )
          : slugify(
              draft.title,
            ),

        features:
          draft.features
            .map(
              (feature) =>
                feature.trim(),
            )
            .filter(Boolean),

        demoUrl:
          draft.demoUrl.trim(),
      };

    if (!clean.title) {
      notify(
        "error",
        "Give the project a title first.",
      );

      throw new Error(
        "Project title is required",
      );
    }

    if (!clean.slug) {
      notify(
        "error",
        "The project needs a valid slug.",
      );

      throw new Error(
        "Project slug is required",
      );
    }

    if (
      clean.demoEnabled &&
      !clean.demoUrl
    ) {
      const message =
        "Add the live demo URL before enabling the demo.";

      notify(
        "error",
        message,
      );

      throw new Error(
        message,
      );
    }

    if (
      clean.demoEnabled &&
      !isValidHttpUrl(
        clean.demoUrl,
      )
    ) {
      const message =
        "Enter a valid live demo URL beginning with http:// or https://.";

      notify(
        "error",
        message,
      );

      throw new Error(
        message,
      );
    }

    const clash =
      projects.some(
        (project) =>
          project.slug ===
            clean.slug &&
          project.id !== id,
      );

    if (clash) {
      const message =
        `The slug "${clean.slug}" is already used.`;

      notify(
        "error",
        message,
      );

      throw new Error(
        message,
      );
    }

    console.log(
      "[projects] Preparing save:",
      {
        mode: id
          ? "update"
          : "create",

        id,
        title:
          clean.title,
        slug:
          clean.slug,
        features:
          clean.features.length,
        images:
          clean.images.length,
        published:
          clean.published,
        demoEnabled:
          clean.demoEnabled,
        demoUrl:
          clean.demoUrl,
      },
    );

    try {
      if (id) {
        console.log(
          `[projects] Updating existing project ${id}...`,
        );

        await withTimeout(
          saveProject(
            id,
            clean,
          ),

          SAVE_TIMEOUT_MS,

          "Updating the project took too long. Check your Firebase connection and try again.",
        );

        console.log(
          `[projects] Project ${id} updated successfully`,
        );
      } else {
        console.log(
          "[projects] Creating new project...",
        );

        await withTimeout(
          createProject(
            clean,
          ),

          SAVE_TIMEOUT_MS,

          "Creating the project took too long. Check your Firebase connection and try again.",
        );

        console.log(
          "[projects] New project created successfully",
        );
      }

      setEditing(null);

      notify(
        "ok",
        id
          ? "Project updated"
          : "Project created",
      );
    } catch (err) {
      console.error(
        "[projects] Save failed:",
        err,
      );

      const message =
        err instanceof Error
          ? err.message
          : "Could not save project";

      notify(
        "error",
        message,
      );

      throw err;
    }
  };

  const handleDelete =
    async (
      project: Project,
    ) => {
      const ok =
        window.confirm(
          `Delete "${project.title}" and its ${
            project.images
              .length
          } image${
            project.images
              .length === 1
              ? ""
              : "s"
          }? This can't be undone.`,
        );

      if (!ok) {
        return;
      }

      try {
        console.log(
          `[projects] Deleting "${project.title}"...`,
        );

        const deleteImageJobs =
          project.images.map(
            (image) =>
              requestCloudinaryDelete(
                image.publicId,
              ),
          );

        await Promise.all(
          deleteImageJobs,
        );

        await withTimeout(
          removeProject(
            project.id,
          ),

          SAVE_TIMEOUT_MS,

          "Deleting the project took too long. Please try again.",
        );

        notify(
          "ok",
          "Project deleted",
        );

        console.log(
          `[projects] Deleted project ${project.id}`,
        );
      } catch (err) {
        console.error(
          "[projects] Delete failed:",
          err,
        );

        notify(
          "error",
          err instanceof Error
            ? err.message
            : "Could not delete project",
        );
      }
    };

  const togglePublished =
    async (
      project: Project,
    ) => {
      try {
        await withTimeout(
          saveProject(
            project.id,
            {
              published:
                !project.published,
            },
          ),

          SAVE_TIMEOUT_MS,

          "Publishing took too long. Please try again.",
        );

        notify(
          "ok",
          project.published
            ? "Moved to draft"
            : "Published",
        );
      } catch (err) {
        console.error(
          "[projects] Publish toggle failed:",
          err,
        );

        notify(
          "error",
          err instanceof Error
            ? err.message
            : "Could not update project",
        );
      }
    };

  const move = async (
    index: number,
    dir: -1 | 1,
  ) => {
    const current =
      projects[index];

    const target =
      projects[
        index + dir
      ];

    if (
      !current ||
      !target
    ) {
      return;
    }

    try {
      await withTimeout(
        Promise.all([
          saveProject(
            current.id,
            {
              order:
                target.order,
            },
          ),

          saveProject(
            target.id,
            {
              order:
                current.order,
            },
          ),
        ]),

        SAVE_TIMEOUT_MS,

        "Reordering took too long. Please try again.",
      );
    } catch (err) {
      console.error(
        "[projects] Reorder failed:",
        err,
      );

      notify(
        "error",
        err instanceof Error
          ? err.message
          : "Could not reorder",
      );
    }
  };

  const publishedCount =
    useMemo(
      () =>
        projects.filter(
          (project) =>
            project.published,
        ).length,

      [projects],
    );

  const demoCount =
    useMemo(
      () =>
        projects.filter(
          (project) =>
            project.demoEnabled &&
            project.demoUrl,
        ).length,

      [projects],
    );

  return (
    <main className="min-h-screen bg-[#FBFAF6] px-4 py-8 text-[#0B1020] sm:px-6 md:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A87B1B]"
              style={{
                fontFamily:
                  mono,
              }}
            >
              Content
            </p>

            <h1
              className="mt-2 text-[2rem] font-bold tracking-[-0.04em] md:text-[2.5rem]"
              style={{
                fontFamily:
                  display,
              }}
            >
              Projects
            </h1>

            <p className="mt-2 max-w-2xl leading-7 text-[#5A6173]">
              Manage your
              portfolio,
              screenshots and
              optional interactive
              live demos from one
              place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className="rounded-full border border-[#EFE3BE] bg-white px-4 py-2 text-sm text-[#5A6173]"
              style={{
                fontFamily:
                  mono,
              }}
            >
              {publishedCount}{" "}
              live ·{" "}
              {projects.length -
                publishedCount}{" "}
              draft
            </span>

            {demoCount >
              0 && (
              <span
                className="inline-flex items-center gap-2 rounded-full border border-[#CAE8D8] bg-[#F1FBF6] px-4 py-2 text-sm text-[#167654]"
                style={{
                  fontFamily:
                    mono,
                }}
              >
                <MonitorPlay
                  size={14}
                />

                {demoCount} demo
                {demoCount ===
                1
                  ? ""
                  : "s"}
              </span>
            )}

            <button
              type="button"
              onClick={
                startNew
              }
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-sm font-semibold text-[#241A05] shadow-[0_10px_30px_-12px_rgba(212,175,55,0.6)] transition hover:brightness-[1.03]"
              style={{
                background:
                  goldBg,

                fontFamily:
                  display,
              }}
            >
              <Plus
                size={16}
                strokeWidth={
                  2.4
                }
              />

              New project
            </button>
          </div>
        </header>

        {!cloudinaryReady && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#F0D6A8] bg-[#FFFBEF] p-4 text-sm text-[#7A5A12]">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <p>
              Cloudinary
              isn&rsquo;t
              configured, so image
              uploads are disabled.
              Set{" "}
              <code className="font-semibold">
                NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
              </code>{" "}
              in{" "}
              <code className="font-semibold">
                .env.local
              </code>{" "}
              and restart the dev
              server.
            </p>
          </div>
        )}

        <section className="mt-8 grid gap-4">
          {loading ? (
            Array.from({
              length: 3,
            }).map(
              (_, index) => (
                <div
                  key={
                    index
                  }
                  className="h-36 animate-pulse rounded-2xl border border-[#EFE3BE] bg-white"
                />
              ),
            )
          ) : loadError ? (
            <Empty
              icon={
                AlertCircle
              }
              title="Couldn't load projects"
              body={
                loadError
              }
            />
          ) : projects.length ===
            0 ? (
            <Empty
              icon={
                ImageIcon
              }
              title="No projects yet"
              body="Create your first one — add the copy, pick an icon, add screenshots and optionally connect a live demo."
            />
          ) : (
            projects.map(
              (
                project,
                index,
              ) => (
                <ProjectRow
                  key={
                    project.id
                  }
                  project={
                    project
                  }
                  first={
                    index ===
                    0
                  }
                  last={
                    index ===
                    projects.length -
                      1
                  }
                  onEdit={() =>
                    startEdit(
                      project,
                    )
                  }
                  onDelete={() =>
                    void handleDelete(
                      project,
                    )
                  }
                  onToggle={() =>
                    void togglePublished(
                      project,
                    )
                  }
                  onMove={(
                    dir,
                  ) =>
                    void move(
                      index,
                      dir,
                    )
                  }
                />
              ),
            )
          )}
        </section>
      </div>

      {editing && (
        <ProjectEditor
          key={
            editing.id ??
            "new"
          }
          initial={
            editing.draft
          }
          isNew={
            !editing.id
          }
          onCancel={() =>
            setEditing(
              null,
            )
          }
          onSave={(
            draft,
          ) =>
            handleSave(
              draft,
              editing.id,
            )
          }
          notify={
            notify
          }
        />
      )}

      <Toasts
        toasts={toasts}
      />
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Project row                                                                */
/* -------------------------------------------------------------------------- */

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
  onMove: (
    dir: -1 | 1,
  ) => void;
}) {
  const Icon =
    iconFor(
      project.iconKey,
    );

  const cover =
    project.images[0];

  const hasDemo =
    project.demoEnabled &&
    Boolean(
      project.demoUrl,
    );

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-[#EFE3BE] bg-white p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="hidden flex-col gap-1 text-[#C6CBD6] sm:flex">
        <button
          type="button"
          onClick={() =>
            onMove(-1)
          }
          disabled={first}
          aria-label="Move up"
          className="rounded p-1 transition hover:text-[#0B1020] disabled:opacity-30"
        >
          <ArrowLeft
            size={14}
            className="rotate-90"
          />
        </button>

        <GripVertical
          size={14}
        />

        <button
          type="button"
          onClick={() =>
            onMove(1)
          }
          disabled={last}
          aria-label="Move down"
          className="rounded p-1 transition hover:text-[#0B1020] disabled:opacity-30"
        >
          <ArrowRight
            size={14}
            className="rotate-90"
          />
        </button>
      </div>

      <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl border border-[#EFE3BE] bg-[#0B1020] sm:h-20 sm:w-28">
        {cover ? (
          <img
            src={cldThumb(
              cover.url,
            )}
            alt={
              cover.alt ||
              project.title
            }
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[#F3DFA2]/70">
            <Icon
              size={20}
              strokeWidth={
                1.8
              }
            />
          </div>
        )}

        {hasDemo && (
          <span
            title="Live demo enabled"
            className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-[#0F7A55] text-white shadow"
          >
            <MonitorPlay
              size={12}
            />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            className="text-lg font-bold tracking-[-0.03em]"
            style={{
              fontFamily:
                display,
            }}
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
            {project.published
              ? "Live"
              : "Draft"}
          </span>

          {hasDemo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F1FBF6] px-2.5 py-0.5 text-[11px] font-semibold text-[#167654]">
              <MonitorPlay
                size={11}
              />

              Demo
            </span>
          )}
        </div>

        <p
          className="mt-1 truncate text-xs text-[#7A8191]"
          style={{
            fontFamily:
              mono,
          }}
        >
          {[
            project.client,
            project.category,
            `/${project.slug}`,
          ]
            .filter(
              Boolean,
            )
            .join(" · ")}
        </p>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#5A6173]">
          {project.description ||
            "No description yet."}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9CA3AF]">
          <span>
            {
              project.images
                .length
            }{" "}
            image
            {project.images
              .length === 1
              ? ""
              : "s"}
          </span>

          <span>·</span>

          <span>
            {
              project.features
                .length
            }{" "}
            feature
            {project.features
              .length === 1
              ? ""
              : "s"}
          </span>

          {hasDemo && (
            <>
              <span>·</span>

              <a
                href={
                  project.demoUrl
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[#A87B1B] hover:underline"
              >
                Open demo

                <ExternalLink
                  size={11}
                />
              </a>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={
            onToggle
          }
          aria-label={
            project.published
              ? "Move to draft"
              : "Publish"
          }
          title={
            project.published
              ? "Move to draft"
              : "Publish"
          }
          className="grid h-10 w-10 place-items-center rounded-full border border-[#EFE3BE] text-[#5A6173] transition hover:bg-[#FBFAF6] hover:text-[#0B1020]"
        >
          {project.published ? (
            <Eye
              size={16}
            />
          ) : (
            <EyeOff
              size={16}
            />
          )}
        </button>

        <button
          type="button"
          onClick={
            onDelete
          }
          aria-label="Delete project"
          title="Delete project"
          className="grid h-10 w-10 place-items-center rounded-full border border-[#EFE3BE] text-[#B4423A] transition hover:bg-[#FFF4F3]"
        >
          <Trash2
            size={16}
          />
        </button>

        <button
          type="button"
          onClick={
            onEdit
          }
          className="min-h-[40px] rounded-full border border-[#EFE3BE] px-5 text-sm font-semibold transition hover:border-[#D4AF37] hover:bg-[#FFFBEF] hover:text-[#A87B1B]"
          style={{
            fontFamily:
              display,
          }}
        >
          Edit
        </button>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */

type Upload = {
  id: string;
  name: string;
  progress: number;
  error?: string;
};

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

  onSave: (
    draft: ProjectDraft,
  ) => Promise<void>;

  notify: (
    tone:
      | "ok"
      | "error",
    message: string,
  ) => void;
}) {
  const [
    draft,
    setDraft,
  ] =
    useState<ProjectDraft>(
      initial,
    );

  const [
    uploads,
    setUploads,
  ] =
    useState<Upload[]>(
      [],
    );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    slugTouched,
    setSlugTouched,
  ] =
    useState(
      Boolean(
        initial.slug,
      ),
    );

  const inputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const [
    over,
    setOver,
  ] = useState(false);

  const set = <
    K extends keyof ProjectDraft,
  >(
    key: K,
    value: ProjectDraft[K],
  ) => {
    setDraft(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  };

  const setTitle = (
    title: string,
  ) => {
    setDraft(
      (current) => ({
        ...current,

        title,

        slug:
          slugTouched
            ? current.slug
            : slugify(
                title,
              ),
      }),
    );
  };

  useEffect(() => {
    const onKey = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key ===
          "Escape" &&
        !saving
      ) {
        onCancel();
      }
    };

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      onKey,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        onKey,
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    onCancel,
    saving,
  ]);

  const addFiles = async (
    files:
      | FileList
      | File[],
  ) => {
    if (
      !cloudinaryReady
    ) {
      notify(
        "error",
        "Cloudinary isn't configured",
      );

      return;
    }

    for (const file of Array.from(
      files,
    )) {
      if (
        file.size >
        MAX_FILE_MB *
          1024 *
          1024
      ) {
        notify(
          "error",
          `${file.name} is over ${MAX_FILE_MB}MB`,
        );

        continue;
      }

      const taskId =
        uid();

      setUploads(
        (current) => [
          ...current,

          {
            id: taskId,
            name: file.name,
            progress: 0,
          },
        ],
      );

      try {
        const result =
          await uploadToCloudinary(
            file,

            (progress) => {
              setUploads(
                (current) =>
                  current.map(
                    (task) =>
                      task.id ===
                      taskId
                        ? {
                            ...task,
                            progress,
                          }
                        : task,
                  ),
              );
            },
          );

        const image: ProjectImage =
          {
            id: uid(),

            url:
              result.secure_url,

            publicId:
              result.public_id,

            label:
              result.original_filename ??
              file.name,

            alt: "",

            width:
              result.width ??
              0,

            height:
              result.height ??
              0,
          };

        setDraft(
          (current) => ({
            ...current,

            images: [
              ...current.images,
              image,
            ],
          }),
        );

        setUploads(
          (current) =>
            current.filter(
              (task) =>
                task.id !==
                taskId,
            ),
        );
      } catch (err) {
        console.error(
          `[projects] Upload failed for ${file.name}:`,
          err,
        );

        setUploads(
          (current) =>
            current.map(
              (task) =>
                task.id ===
                taskId
                  ? {
                      ...task,

                      error:
                        err instanceof Error
                          ? err.message
                          : "Upload failed",
                    }
                  : task,
            ),
        );
      }
    }
  };

  const patchImage = (
    id: string,
    changes:
      Partial<ProjectImage>,
  ) => {
    setDraft(
      (current) => ({
        ...current,

        images:
          current.images.map(
            (image) =>
              image.id ===
              id
                ? {
                    ...image,
                    ...changes,
                  }
                : image,
          ),
      }),
    );
  };

  const dropImage = (
    id: string,
  ) => {
    setDraft(
      (current) => ({
        ...current,

        images:
          current.images.filter(
            (image) =>
              image.id !==
              id,
          ),
      }),
    );
  };

  const moveImage = (
    index: number,
    dir: -1 | 1,
  ) => {
    setDraft(
      (current) => {
        const next = [
          ...current.images,
        ];

        const target =
          index + dir;

        if (
          target < 0 ||
          target >=
            next.length
        ) {
          return current;
        }

        [
          next[index],
          next[target],
        ] = [
          next[target],
          next[index],
        ];

        return {
          ...current,
          images: next,
        };
      },
    );
  };

  const makeCover = (
    index: number,
  ) => {
    setDraft(
      (current) => {
        const next = [
          ...current.images,
        ];

        const [item] =
          next.splice(
            index,
            1,
          );

        if (!item) {
          return current;
        }

        return {
          ...current,

          images: [
            item,
            ...next,
          ],
        };
      },
    );
  };

  const submit = async () => {
    if (saving) {
      return;
    }

    if (
      uploads.some(
        (upload) =>
          !upload.error,
      )
    ) {
      notify(
        "error",
        "Wait for your images to finish uploading before saving.",
      );

      return;
    }

    try {
      setSaving(true);

      console.log(
        "[projects] Editor submitting project",
      );

      await onSave(
        draft,
      );
    } catch (err) {
      console.error(
        "[projects] Editor submit failed:",
        err,
      );
    } finally {
      setSaving(false);
    }
  };

  const IconPreview =
    iconFor(
      draft.iconKey,
    );

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
      <div
        onClick={() => {
          if (!saving) {
            onCancel();
          }
        }}
        className="absolute inset-0 bg-[#0B1020]/70 backdrop-blur-[3px]"
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={
          isNew
            ? "New project"
            : "Edit project"
        }
        className="relative z-10 flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[1.5rem] border border-[#EFE3BE] bg-white shadow-[0_40px_120px_-30px_rgba(11,16,32,0.55)] sm:max-h-[90dvh] sm:rounded-[1.5rem]"
      >
        {/* header */}

        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#F0E8D2] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[#EFE3BE] bg-[#FFFBEF] text-[#A87B1B]">
              <IconPreview
                size={18}
                strokeWidth={
                  1.9
                }
              />
            </span>

            <h2
              className="text-lg font-bold tracking-[-0.03em]"
              style={{
                fontFamily:
                  display,
              }}
            >
              {isNew
                ? "New project"
                : draft.title ||
                  "Edit project"}
            </h2>
          </div>

          <button
            type="button"
            onClick={
              onCancel
            }
            disabled={
              saving
            }
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full border border-[#EFE3BE] text-[#5A6173] transition hover:bg-[#FBFAF6] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X
              size={17}
            />
          </button>
        </div>

        {/* body */}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          <SectionTitle>
            Details
          </SectionTitle>

          <div className="grid gap-4">
            <Field label="Title">
              <input
                value={
                  draft.title
                }
                onChange={(
                  event,
                ) =>
                  setTitle(
                    event.target
                      .value,
                  )
                }
                placeholder="Distribution & Construction Platform"
                className={
                  inputClass
                }
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Client"
                hint="Shown as “Built for …”. Leave blank to hide."
              >
                <input
                  value={
                    draft.client
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "client",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Meldex Industries"
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field label="Category">
                <input
                  value={
                    draft.category
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "category",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Industrial operations"
                  className={
                    inputClass
                  }
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <input
                  list="status-options"
                  value={
                    draft.status
                  }
                  onChange={(
                    event,
                  ) =>
                    set(
                      "status",
                      event.target
                        .value,
                    )
                  }
                  className={
                    inputClass
                  }
                />

                <datalist id="status-options">
                  {STATUS_OPTIONS.map(
                    (
                      status,
                    ) => (
                      <option
                        key={
                          status
                        }
                        value={
                          status
                        }
                      />
                    ),
                  )}
                </datalist>
              </Field>

              <Field
                label="Slug"
                hint="Used in URLs. Follows the title until you edit it."
              >
                <input
                  value={
                    draft.slug
                  }
                  onChange={(
                    event,
                  ) => {
                    setSlugTouched(
                      true,
                    );

                    set(
                      "slug",
                      slugify(
                        event
                          .target
                          .value,
                      ),
                    );
                  }}
                  placeholder="meldex"
                  className={
                    inputClass
                  }
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={
                  draft.description
                }
                onChange={(
                  event,
                ) =>
                  set(
                    "description",
                    event.target
                      .value,
                  )
                }
                rows={4}
                placeholder="What the platform does and who it's for."
                className={`${inputClass} h-auto py-3 leading-7`}
              />
            </Field>

            {/* ------------------------------------------------------ */}
            {/* Live demo                                              */}
            {/* ------------------------------------------------------ */}

            <div
              className={`rounded-2xl border p-5 transition ${
                draft.demoEnabled
                  ? "border-[#D8C786] bg-[#FFFDF5]"
                  : "border-[#EFE3BE] bg-[#FBFAF6]"
              }`}
            >
              <div className="flex items-start justify-between gap-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                      draft.demoEnabled
                        ? "border-[#E5D79D] bg-[#FFF7D8] text-[#A87B1B]"
                        : "border-[#E8E2D2] bg-white text-[#8A8F9A]"
                    }`}
                  >
                    <MonitorPlay
                      size={
                        18
                      }
                    />
                  </span>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#0B1020]">
                        Live demo
                      </p>

                      {draft.demoEnabled && (
                        <span className="rounded-full bg-[#ECFBF4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0F7A55]">
                          Enabled
                        </span>
                      )}
                    </div>

                    <p className="mt-1 max-w-lg text-xs leading-5 text-[#7A8191]">
                      Connect a
                      public demo
                      deployment for
                      this project.
                      Visitors will
                      see a Launch
                      Live Demo button
                      on the
                      portfolio.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={
                    draft.demoEnabled
                  }
                  onClick={() =>
                    set(
                      "demoEnabled",
                      !draft.demoEnabled,
                    )
                  }
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    draft.demoEnabled
                      ? "bg-[#D4AF37]"
                      : "bg-[#DDD8CA]"
                  }`}
                >
                  <span
                    className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform ${
                      draft.demoEnabled
                        ? "translate-x-[23px]"
                        : "translate-x-[3px]"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-5">
                <label className="block">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A87B1B]"
                    style={{
                      fontFamily:
                        mono,
                    }}
                  >
                    Demo URL
                  </span>

                  <div className="relative mt-2">
                    <input
                      type="url"
                      value={
                        draft.demoUrl
                      }
                      onChange={(
                        event,
                      ) =>
                        set(
                          "demoUrl",
                          event.target
                            .value,
                        )
                      }
                      disabled={
                        !draft.demoEnabled
                      }
                      placeholder="https://esteem-demo.vercel.app"
                      className={`${inputClass} pr-11 disabled:cursor-not-allowed disabled:bg-[#F1EFE8] disabled:text-[#A4A7AE]`}
                    />

                    <ExternalLink
                      size={15}
                      className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 ${
                        draft.demoEnabled
                          ? "text-[#A87B1B]"
                          : "text-[#B7B9BF]"
                      }`}
                    />
                  </div>
                </label>

                {draft.demoEnabled &&
                  draft.demoUrl && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p
                        className={`text-xs ${
                          isValidHttpUrl(
                            draft.demoUrl,
                          )
                            ? "text-[#0F7A55]"
                            : "text-[#B4423A]"
                        }`}
                      >
                        {isValidHttpUrl(
                          draft.demoUrl,
                        )
                          ? "Demo URL looks valid."
                          : "Use a full URL beginning with https://"}
                      </p>

                      {isValidHttpUrl(
                        draft.demoUrl,
                      ) && (
                        <a
                          href={
                            draft.demoUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A87B1B] transition hover:text-[#8D681A] hover:underline"
                        >
                          Preview
                          demo

                          <ExternalLink
                            size={
                              12
                            }
                          />
                        </a>
                      )}
                    </div>
                  )}
              </div>
            </div>

            <Field label="Icon">
              <div className="flex flex-wrap gap-2">
                {(
                  Object.keys(
                    PROJECT_ICONS,
                  ) as IconKey[]
                ).map(
                  (key) => {
                    const {
                      icon: Icon,
                      label,
                    } =
                      PROJECT_ICONS[
                        key
                      ];

                    const active =
                      draft.iconKey ===
                      key;

                    return (
                      <button
                        key={
                          key
                        }
                        type="button"
                        onClick={() =>
                          set(
                            "iconKey",
                            key,
                          )
                        }
                        title={
                          label
                        }
                        aria-label={
                          label
                        }
                        aria-pressed={
                          active
                        }
                        className={`grid h-11 w-11 place-items-center rounded-xl border transition ${
                          active
                            ? "border-[#D4AF37] bg-[#FFFBEF] text-[#A87B1B]"
                            : "border-[#EFE3BE] text-[#5A6173] hover:border-[#E2D6B0]"
                        }`}
                      >
                        <Icon
                          size={
                            18
                          }
                          strokeWidth={
                            1.9
                          }
                        />
                      </button>
                    );
                  },
                )}
              </div>
            </Field>
          </div>

          {/* features */}

          <SectionTitle className="mt-9">
            Inside the build
          </SectionTitle>

          <p className="-mt-3 mb-3 text-sm text-[#7A8191]">
            Add the most
            important modules or
            capabilities included
            in this project.
          </p>

          <div className="grid gap-2.5">
            {draft.features.map(
              (
                feature,
                index,
              ) => (
                <div
                  key={
                    index
                  }
                  className="flex items-center gap-2"
                >
                  <input
                    value={
                      feature
                    }
                    onChange={(
                      event,
                    ) => {
                      const next =
                        [
                          ...draft.features,
                        ];

                      next[
                        index
                      ] =
                        event.target.value;

                      set(
                        "features",
                        next,
                      );
                    }}
                    placeholder="Client portal"
                    className={
                      inputClass
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "features",

                        draft.features.filter(
                          (
                            _,
                            featureIndex,
                          ) =>
                            featureIndex !==
                            index,
                        ),
                      )
                    }
                    aria-label="Remove feature"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#EFE3BE] text-[#B4423A] transition hover:bg-[#FFF4F3]"
                  >
                    <X
                      size={16}
                    />
                  </button>
                </div>
              ),
            )}

            <button
              type="button"
              onClick={() =>
                set(
                  "features",
                  [
                    ...draft.features,
                    "",
                  ],
                )
              }
              className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-full border border-dashed border-[#DFD3B4] px-4 text-sm font-semibold text-[#A87B1B] transition hover:bg-[#FFFBEF]"
            >
              <Plus
                size={15}
                strokeWidth={
                  2.4
                }
              />

              Add feature
            </button>
          </div>

          {/* screenshots */}

          <SectionTitle className="mt-9">
            Screenshots
          </SectionTitle>

          <p className="-mt-3 mb-3 text-sm text-[#7A8191]">
            The first image is
            the project cover.
            Add as many
            screenshots as you
            need for the full
            case-study gallery.
          </p>

          <div
            onDragOver={(
              event,
            ) => {
              event.preventDefault();

              setOver(
                true,
              );
            }}
            onDragLeave={() =>
              setOver(
                false,
              )
            }
            onDrop={(
              event: DragEvent<HTMLDivElement>,
            ) => {
              event.preventDefault();

              setOver(
                false,
              );

              if (
                event.dataTransfer
                  .files?.length
              ) {
                void addFiles(
                  event
                    .dataTransfer
                    .files,
                );
              }
            }}
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
              over
                ? "border-[#D4AF37] bg-[#FFFBEF]"
                : "border-[#EFE3BE] bg-[#FBFAF6]"
            }`}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#EFE3BE] bg-white text-[#A87B1B]">
              <UploadCloud
                size={20}
                strokeWidth={
                  1.9
                }
              />
            </div>

            <p className="mt-3 text-sm text-[#5A6173]">
              Drop images here,
              or
            </p>

            <button
              type="button"
              disabled={
                !cloudinaryReady
              }
              onClick={() =>
                inputRef.current?.click()
              }
              className="mt-3 min-h-[44px] rounded-full border border-[#EFE3BE] bg-white px-5 text-sm font-semibold transition hover:border-[#D4AF37] hover:text-[#A87B1B] disabled:opacity-50"
              style={{
                fontFamily:
                  display,
              }}
            >
              Choose files
            </button>

            <input
              ref={
                inputRef
              }
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(
                event: ChangeEvent<HTMLInputElement>,
              ) => {
                if (
                  event.target
                    .files
                    ?.length
                ) {
                  void addFiles(
                    event.target
                      .files,
                  );
                }

                event.target.value =
                  "";
              }}
            />
          </div>

          {/* uploads */}

          {uploads.length >
            0 && (
            <div className="mt-3 grid gap-2">
              {uploads.map(
                (task) => (
                  <div
                    key={
                      task.id
                    }
                    className="flex items-center gap-3 rounded-xl border border-[#EFE3BE] bg-white px-4 py-3"
                  >
                    {task.error ? (
                      <AlertCircle
                        size={
                          15
                        }
                        className="shrink-0 text-[#B4423A]"
                      />
                    ) : (
                      <Loader2
                        size={
                          15
                        }
                        className="shrink-0 animate-spin text-[#A87B1B]"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {
                          task.name
                        }
                      </p>

                      {task.error ? (
                        <p className="mt-0.5 text-xs text-[#B4423A]">
                          {
                            task.error
                          }
                        </p>
                      ) : (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F1EBDA]">
                          <div
                            className="h-full rounded-full transition-[width] duration-200"
                            style={{
                              width: `${task.progress}%`,

                              background:
                                "linear-gradient(90deg,#F3DFA2,#D4AF37)",
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <span className="shrink-0 text-xs text-[#7A8191]">
                      {task.error
                        ? "Failed"
                        : `${task.progress}%`}
                    </span>
                  </div>
                ),
              )}
            </div>
          )}

          {/* screenshot cards */}

          {draft.images
            .length >
            0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {draft.images.map(
                (
                  image,
                  index,
                ) => (
                  <div
                    key={
                      image.id
                    }
                    className="overflow-hidden rounded-2xl border border-[#EFE3BE] bg-white"
                  >
                    <div className="relative aspect-[4/3] bg-[#0B1020]">
                      <img
                        src={cldThumb(
                          image.url,
                        )}
                        alt={
                          image.alt ||
                          image.label
                        }
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />

                      {index ===
                        0 && (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#D4AF37] px-2.5 py-1 text-[11px] font-semibold text-[#241A05]">
                          <Star
                            size={
                              11
                            }
                            strokeWidth={
                              2.6
                            }
                          />

                          Cover
                        </span>
                      )}

                      <div className="absolute bottom-2 right-2 flex gap-1.5">
                        <MiniButton
                          label="Move left"
                          onClick={() =>
                            moveImage(
                              index,
                              -1,
                            )
                          }
                          disabled={
                            index ===
                            0
                          }
                        >
                          <ArrowLeft
                            size={
                              14
                            }
                          />
                        </MiniButton>

                        <MiniButton
                          label="Move right"
                          onClick={() =>
                            moveImage(
                              index,
                              1,
                            )
                          }
                          disabled={
                            index ===
                            draft
                              .images
                              .length -
                              1
                          }
                        >
                          <ArrowRight
                            size={
                              14
                            }
                          />
                        </MiniButton>

                        {index !==
                          0 && (
                          <MiniButton
                            label="Make cover"
                            onClick={() =>
                              makeCover(
                                index,
                              )
                            }
                          >
                            <Star
                              size={
                                14
                              }
                            />
                          </MiniButton>
                        )}

                        <MiniButton
                          label="Remove image"
                          tone="danger"
                          onClick={() =>
                            dropImage(
                              image.id,
                            )
                          }
                        >
                          <Trash2
                            size={
                              14
                            }
                          />
                        </MiniButton>
                      </div>
                    </div>

                    <div className="grid gap-2 p-3">
                      <input
                        value={
                          image.label
                        }
                        onChange={(
                          event,
                        ) =>
                          patchImage(
                            image.id,
                            {
                              label:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                        placeholder="Caption, e.g. Operations dashboard"
                        className="h-10 w-full rounded-lg border border-[#EFE3BE] px-3 text-sm outline-none focus:border-[#D4AF37]"
                      />

                      <input
                        value={
                          image.alt
                        }
                        onChange={(
                          event,
                        ) =>
                          patchImage(
                            image.id,
                            {
                              alt:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                        placeholder="Alt text for screen readers"
                        className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-[#D4AF37] ${
                          image.alt
                            ? "border-[#EFE3BE]"
                            : "border-[#F3C9C4] bg-[#FFF9F8]"
                        }`}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {/* footer */}

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#F0E8D2] px-5 py-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={
                draft.published
              }
              disabled={
                saving
              }
              onChange={(
                event,
              ) =>
                set(
                  "published",
                  event.target
                    .checked,
                )
              }
              className="h-4 w-4 accent-[#D4AF37]"
            />

            Publish to the
            work page
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={
                onCancel
              }
              disabled={
                saving
              }
              className="min-h-[44px] rounded-full px-5 text-sm font-semibold text-[#5A6173] transition hover:text-[#0B1020] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() =>
                void submit()
              }
              disabled={
                saving
              }
              className="inline-flex min-h-[44px] min-w-[140px] items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-[#241A05] shadow-[0_10px_30px_-12px_rgba(212,175,55,0.6)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background:
                  goldBg,

                fontFamily:
                  display,
              }}
            >
              {saving && (
                <Loader2
                  size={15}
                  className="animate-spin"
                />
              )}

              {saving
                ? isNew
                  ? "Creating..."
                  : "Saving..."
                : isNew
                  ? "Create project"
                  : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* UI helpers                                                                 */
/* -------------------------------------------------------------------------- */

const inputClass =
  "h-11 w-full rounded-xl border border-[#EFE3BE] bg-white px-4 text-sm outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15";

function SectionTitle({
  children,
  className = "",
}: {
  children:
    React.ReactNode;

  className?: string;
}) {
  return (
    <p
      className={`mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#A87B1B] ${className}`}
      style={{
        fontFamily:
          mono,
      }}
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

  children:
    React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#0B1020]">
        {label}
      </span>

      {hint && (
        <span className="mt-0.5 block text-xs text-[#7A8191]">
          {hint}
        </span>
      )}

      <div className="mt-2">
        {children}
      </div>
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
  children:
    React.ReactNode;

  label: string;

  onClick: () => void;

  disabled?: boolean;

  tone?:
    | "default"
    | "danger";
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      aria-label={
        label
      }
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-full bg-white/92 shadow-sm transition hover:bg-white disabled:opacity-40 ${
        tone ===
        "danger"
          ? "text-[#B4423A]"
          : "text-[#0B1020]"
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
  icon:
    typeof ImageIcon;

  title: string;

  body: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[#EFE3BE] bg-white px-6 py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#EFE3BE] bg-[#FFFBEF] text-[#A87B1B]">
        <Icon
          size={24}
          strokeWidth={
            1.9
          }
        />
      </div>

      <p
        className="mt-4 text-lg font-bold tracking-[-0.02em]"
        style={{
          fontFamily:
            display,
        }}
      >
        {title}
      </p>

      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-[#5A6173]">
        {body}
      </p>
    </div>
  );
}

function Toasts({
  toasts,
}: {
  toasts: Toast[];
}) {
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2">
      {toasts.map(
        (toast) => (
          <div
            key={
              toast.id
            }
            className={`flex items-center gap-2.5 rounded-full border px-4 py-3 text-sm font-medium shadow-lg ${
              toast.tone ===
              "ok"
                ? "border-[#EFE3BE] bg-white text-[#0B1020]"
                : "border-[#F3C9C4] bg-[#FFF4F3] text-[#B4423A]"
            }`}
          >
            {toast.tone ===
            "ok" ? (
              <Check
                size={15}
                strokeWidth={
                  2.6
                }
              />
            ) : (
              <AlertCircle
                size={15}
              />
            )}

            {toast.message}
          </div>
        ),
      )}
    </div>
  );
}