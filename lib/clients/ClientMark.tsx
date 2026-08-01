// components/clients/ClientMark.tsx
//
// The client's own crest. White tile with a hairline border rather than a
// gradient — a logo carries its own colours and fights anything behind it.
// Falls back to a lettermark when no logo is on file, which reads as a
// deliberate placeholder rather than a generic icon.

import Image from 'next/image';

const SIZES = {
  sm: { box: 'h-10 w-10 rounded-xl p-1', px: 40, text: 'text-[11px]' },
  md: { box: 'h-12 w-12 rounded-2xl p-1.5', px: 48, text: 'text-xs' },
  lg: { box: 'h-14 w-14 rounded-2xl p-1.5', px: 56, text: 'text-sm' },
} as const;

export function ClientMark({
  logo,
  name,
  size = 'md',
  priority = false,
}: {
  logo: string | null;
  name: string;
  size?: keyof typeof SIZES;
  priority?: boolean;
}) {
  const current = SIZES[size];

  if (!logo) {
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

    return (
      <div
        className={`flex shrink-0 items-center justify-center border border-[#0B1020]/[0.07] bg-[#FAFAF9] font-bold text-[#5A6173] ${current.box} ${current.text}`}
      >
        {initials || '—'}
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-[#0B1020]/[0.07] bg-white shadow-sm ${current.box}`}
    >
      <Image
        src={logo}
        alt={`${name} logo`}
        width={current.px}
        height={current.px}
        className="h-full w-full object-contain"
        priority={priority}
      />
    </div>
  );
}