import { ImageResponse } from "next/og";

// Apple home-screen icon (180×180 PNG). Next.js renders this on demand and
// caches at build time so we don't ship an actual .png file — the checkmark
// shield stays in code, easy to tweak.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4a7c8c 0%, #06304a 100%)",
          color: "white",
          fontSize: 100,
          fontWeight: 800,
          letterSpacing: "-0.04em",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 48 48" fill="none">
          <path
            d="M24 3c-3 3-8 5-14 6v14c0 8 5 14 14 20 9-6 14-12 14-20V9c-6-1-11-3-14-6Z"
            fill="white"
            fillOpacity="0.15"
            stroke="white"
            strokeWidth="2"
          />
          <path
            d="M17 25l5 5 9-12"
            fill="none"
            stroke="white"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="37" cy="11" r="4" fill="#e8956b" />
        </svg>
      </div>
    ),
    size,
  );
}
