'use client';

// Shared logo uploader for the Add Client wizard and the Edit Client dialog.
// Click-to-upload + drag/drop, progress, replace/remove, inline errors, and
// an initials fallback when there's no logo — matching the ClientLogo look
// used elsewhere in the admin.

import { useRef, useState } from 'react';
import { AlertCircle, Building2, Loader2, Pencil, X } from 'lucide-react';

import { MAX_LOGO_MB, deleteClientLogo, uploadClientLogo } from '@/lib/clients/uploadClientLogo';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]';

function initialsOf(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function LogoPreview({ logoUrl, title }: { logoUrl: string; title: string }) {
  if (logoUrl) {
    return (
      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-[18px] border border-[var(--line)] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className="h-full w-full object-contain p-1.5" />
      </span>
    );
  }

  const letters = initialsOf(title);

  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] text-[15px] font-bold text-[var(--text)]">
      {letters || <Building2 size={20} strokeWidth={1.8} className="text-[var(--text-subtle)]" />}
    </span>
  );
}

export function LogoUploader({
  logoUrl,
  logoPublicId,
  title,
  onChange,
}: {
  logoUrl: string;
  logoPublicId: string;
  title: string;
  onChange: (logoUrl: string, logoPublicId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const validate = (file: File): string | null => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      return 'Use a PNG, JPEG or WebP image.';
    }
    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      return `Keep it under ${MAX_LOGO_MB}MB.`;
    }
    return null;
  };

  const handleFile = async (file: File) => {
    const issue = validate(file);
    if (issue) {
      setUploadError(issue);
      return;
    }

    setUploadError(null);
    setUploading(true);
    setProgress(0);

    const previousPublicId = logoPublicId;

    try {
      const result = await uploadClientLogo(file, setProgress);
      onChange(result.url, result.publicId);
      // The previous upload (if any) was a temporary one from this same
      // editing session, never persisted, so clean it up now. A persisted
      // logo has no tracked publicId here and is never touched this way.
      if (previousPublicId) void deleteClientLogo(previousPublicId);
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : 'The logo could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };

  const remove = () => {
    if (logoPublicId) void deleteClientLogo(logoPublicId);
    onChange('', '');
    setUploadError(null);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold text-[var(--text-muted)]">Logo</span>
        <span className="truncate text-[8px] text-[var(--text-subtle)]">PNG, JPEG or WebP · up to {MAX_LOGO_MB}MB</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            if (!uploading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file && !uploading) void handleFile(file);
          }}
          disabled={uploading}
          aria-label={logoUrl ? 'Replace logo' : 'Upload logo'}
          className={cx(
            'group relative shrink-0 rounded-[18px] disabled:cursor-wait',
            dragging && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]',
            focusRing,
          )}
        >
          <LogoPreview logoUrl={logoUrl} title={title} />
          <span
            className={cx(
              'absolute inset-0 flex items-center justify-center rounded-[18px] transition-colors',
              uploading ? 'bg-black/40' : 'bg-black/0 group-hover:bg-black/40',
            )}
          >
            {uploading ? (
              <Loader2 size={16} className="animate-spin text-white" />
            ) : (
              <Pencil size={14} className="text-white opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void handleFile(file);
          }}
        />

        <div className="min-w-0 flex-1">
          {uploading ? (
            <div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-[9px] text-[var(--text-subtle)]">Uploading… {progress}%</p>
            </div>
          ) : logoUrl ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={cx('inline-flex items-center gap-1 rounded-md text-[9px] font-semibold text-[var(--accent)] hover:opacity-80', focusRing)}
              >
                <Pencil size={10} />
                Replace
              </button>
              <span className="text-[var(--text-subtle)]">·</span>
              <button
                type="button"
                onClick={remove}
                className={cx('inline-flex items-center gap-1 rounded-md text-[9px] font-semibold text-[var(--text-subtle)] hover:text-red-600', focusRing)}
              >
                <X size={10} />
                Remove
              </button>
            </div>
          ) : (
            <p className="text-[9px] leading-4 text-[var(--text-subtle)]">
              Click or drag an image here. Without one, we&apos;ll show initials instead.
            </p>
          )}

          {uploadError ? (
            <p role="alert" className="mt-1 flex items-center gap-1 text-[9px] font-medium text-red-600">
              <AlertCircle size={10} />
              {uploadError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
