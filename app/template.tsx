'use client';

/**
 * app/dashboard/template.tsx
 *
 * The second half of the sign in handover. The welcome overlay clears its
 * content and leaves a plain light field behind, then this lifts the dashboard
 * into that field instead of snapping it on. Next remounts a template on every
 * navigation, so this also softens moves between dashboard routes.
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-enter">
      {children}

      <style jsx>{`
        .dashboard-enter {
          animation: dashboard-in 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
          will-change: opacity, transform, filter;
        }

        @keyframes dashboard-in {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
            filter: blur(6px);
          }
          55% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dashboard-enter {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}