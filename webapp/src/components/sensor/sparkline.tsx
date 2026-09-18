"use client";

/**
 * Lightweight inline sparkline — a smoothed line + fill drawn from a small
 * rolling buffer. No dependencies: we're rendering ~30 samples so recharts
 * would be overkill (and each SVG is < 1 KB).
 */
export function Sparkline({
  values,
  stroke = "var(--brand)",
  fill = "var(--brand-soft)",
  height = 40,
  className,
}: {
  values: number[];
  stroke?: string;
  fill?: string;
  height?: number;
  className?: string;
}) {
  const n = values.length;
  if (n < 2) {
    return (
      <div
        className={className}
        style={{ height }}
        aria-hidden
      />
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const w = 100;
  const stepX = w / (n - 1);
  const pts = values.map((v, i) => {
    const x = i * stepX;
    // invert Y so higher values sit higher on screen
    const y = 100 - ((v - min) / range) * 100;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const path = "M" + pts.join(" L");
  const area = `${path} L${w},100 L0,100 Z`;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height }}
      aria-hidden
    >
      <path d={area} fill={fill} opacity={0.6} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
