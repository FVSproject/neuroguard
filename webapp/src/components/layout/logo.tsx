import type { SVGProps } from "react";

/**
 * NeuroGuard wordmark logo — a soft rounded shield with an animated pulse dot.
 * Ships as an SVG so it scales cleanly at any size and inherits `currentColor`.
 */
export function LogoMark({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={className}
      {...rest}
    >
      <defs>
        <linearGradient id="ng-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--brand-strong)" />
        </linearGradient>
      </defs>
      <path
        d="M24 4c-3 3-8 5-14 6v14c0 8 5 14 14 20 9-6 14-12 14-20V10c-6-1-11-3-14-6Z"
        fill="url(#ng-logo-grad)"
      />
      <path
        d="M18 26l4 4 8-10"
        stroke="white"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx={36} cy={12} r={4} fill="var(--accent)" className="pulse-soft" />
    </svg>
  );
}
