import type { SVGProps } from "react";

/**
 * Foot bracelet icon — a strap around a small oval with an optical window,
 * drawn on a 48×48 grid. Represents the wearable node.
 */
export function WristbandIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M8 24c0-4 3-7 7-7h18c4 0 7 3 7 7s-3 7-7 7H15c-4 0-7-3-7-7Z" />
      <rect x={18} y={19} width={12} height={10} rx={2} fill="currentColor" opacity={0.15} />
      <circle cx={24} cy={24} r={2} fill="currentColor" />
      <path d="M6 24h2M40 24h2" />
    </svg>
  );
}
