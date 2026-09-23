'use client';

import Image from 'next/image';

type Mark = {
  top: string;
  left: string;
  size: number;
  opacity: number;
  duration: string;
  delay: string;
  rotate: string;
  small?: boolean;
};

/* Marks are placed around the edges so the sign in card always sits clear. */
const MARKS: Mark[] = [
  { top: '8%', left: '7%', size: 116, opacity: 0.1, duration: '19s', delay: '0s', rotate: '-8deg' },
  { top: '18%', left: '78%', size: 148, opacity: 0.08, duration: '24s', delay: '1.6s', rotate: '10deg' },
  { top: '62%', left: '4%', size: 132, opacity: 0.07, duration: '21s', delay: '0.8s', rotate: '6deg' },
  { top: '74%', left: '82%', size: 104, opacity: 0.09, duration: '26s', delay: '2.4s', rotate: '-12deg' },
  { top: '40%', left: '88%', size: 72, opacity: 0.08, duration: '17s', delay: '3.1s', rotate: '14deg', small: true },
  { top: '46%', left: '2%', size: 64, opacity: 0.07, duration: '23s', delay: '1.1s', rotate: '-6deg', small: true },
  { top: '88%', left: '44%', size: 88, opacity: 0.06, duration: '20s', delay: '2.9s', rotate: '9deg', small: true },
  { top: '2%', left: '46%', size: 80, opacity: 0.06, duration: '25s', delay: '0.4s', rotate: '-4deg', small: true },
];

export default function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="backdrop pointer-events-none absolute inset-0">
      {MARKS.map((mark, index) => (
        <span
          key={index}
          className={`mark ${mark.small ? 'mark-small' : ''} ${
            index % 2 === 0 ? 'mark-a' : 'mark-b'
          }`}
          style={{
            top: mark.top,
            left: mark.left,
            width: mark.size,
            height: mark.size,
            opacity: mark.opacity,
            animationDuration: mark.duration,
            animationDelay: mark.delay,
            ['--tilt' as string]: mark.rotate,
          }}
        >
          <Image
            src="/images/syntra-logo.png"
            alt=""
            width={mark.size}
            height={mark.size}
            className="h-full w-full object-contain"
          />
        </span>
      ))}

      <style jsx>{`
        .backdrop {
          /* Keeps the middle of the screen clean behind the card. */
          mask-image: radial-gradient(
            ellipse 44% 46% at 50% 50%,
            transparent 45%,
            #000 78%
          );
          -webkit-mask-image: radial-gradient(
            ellipse 44% 46% at 50% 50%,
            transparent 45%,
            #000 78%
          );
        }

        .mark {
          position: absolute;
          display: block;
          transform: rotate(var(--tilt));
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          filter: grayscale(0.15);
        }

        .mark-a {
          animation-name: drift-a;
        }

        .mark-b {
          animation-name: drift-b;
        }

        @keyframes drift-a {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(var(--tilt));
          }
          50% {
            transform: translate3d(14px, -26px, 0)
              rotate(calc(var(--tilt) + 6deg));
          }
        }

        @keyframes drift-b {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(var(--tilt));
          }
          50% {
            transform: translate3d(-18px, 22px, 0)
              rotate(calc(var(--tilt) - 5deg));
          }
        }

        @media (max-width: 767px) {
          .mark-small {
            display: none;
          }

          .mark {
            opacity: 0.05 !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mark {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}