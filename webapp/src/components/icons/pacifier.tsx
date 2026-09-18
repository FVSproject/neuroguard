import type { SVGProps } from "react";

/**
 * Stylised pacifier icon — a shield with a nipple, drawn on a 48×48 grid.
 * Uses `currentColor` so parents of `Icon` control the fill via `text-*`.
 */
export function PacifierIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <ellipse cx={24} cy={22} rx={14} ry={10} />
      <path d="M12 22c-3 0-5 2-5 5s2 5 5 5" />
      <path d="M36 22c3 0 5 2 5 5s-2 5-5 5" />
      <ellipse cx={24} cy={22} rx={5} ry={4} fill="currentColor" opacity={0.15} />
      <path d="M24 32v6" />
      <circle cx={24} cy={41} r={3.5} />
    </svg>
  );
}
