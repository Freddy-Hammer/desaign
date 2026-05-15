import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

// Dynamically generated social-share card. Next.js serves this for both
// Open Graph and Twitter previews across the whole site.
export const runtime = "edge";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#f7f4ef",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "9999px",
              backgroundColor: "#758666",
            }}
          />
          <div
            style={{
              fontSize: "30px",
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#475240",
            }}
          >
            {SITE_NAME}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: "84px",
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "#18181b",
          }}
        >
          Useful signals for designers working with AI.
        </div>

        <div
          style={{
            display: "flex",
            fontSize: "32px",
            fontWeight: 500,
            color: "#52525b",
          }}
        >
          Videos · launches · case studies · tools · essays · jobs
        </div>
      </div>
    ),
    { ...size },
  );
}
