import { ImageResponse } from "next/og";
import { getSkillsSnapshot, snapshotMonth } from "@/lib/skills-snapshot";
import { SITE_NAME } from "@/lib/seo";

// Share card for the skills snapshot — bakes the live top-5 tools into the
// image, so a LinkedIn / Reddit preview *is* the data.
export const alt = "Top tools designers are being asked for";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function SnapshotOgImage() {
  const { tools } = await getSkillsSnapshot();
  const top = tools.slice(0, 5);

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
          padding: "70px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              fontSize: "26px",
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#475240",
            }}
          >
            {`${SITE_NAME} · ${snapshotMonth()}`}
          </div>
          <div
            style={{
              fontSize: "60px",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "#18181b",
            }}
          >
            Tools designers are asked for
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {top.length === 0 ? (
            <div style={{ display: "flex", fontSize: "32px", color: "#52525b" }}>
              Ranked from active designer job postings.
            </div>
          ) : (
            top.map((t, i) => (
              <div
                key={t.name}
                style={{ display: "flex", alignItems: "center", gap: "24px" }}
              >
                <div
                  style={{
                    fontSize: "44px",
                    fontWeight: 900,
                    color: "#758666",
                    width: "60px",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div
                  style={{
                    fontSize: "44px",
                    fontWeight: 800,
                    color: "#18181b",
                  }}
                >
                  {t.name}
                </div>
                <div
                  style={{ fontSize: "28px", color: "#a1a1aa", marginLeft: "auto" }}
                >
                  {`${t.count} ${t.count === 1 ? "job" : "jobs"}`}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", fontSize: "26px", color: "#52525b" }}>
          desaign-radar.vercel.app/skills-and-tools/snapshot
        </div>
      </div>
    ),
    { ...size },
  );
}
