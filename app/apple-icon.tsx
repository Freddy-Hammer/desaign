import { ImageResponse } from "next/og";

// Home-screen icon for iOS "Add to Home Screen" (180×180 is the standard).
// Matches the favicon.png look — dark "D" on the site's cream background —
// generated so it stays crisp at this larger size.
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
          background: "#f7f4ef",
          color: "#1c1917",
          fontSize: 124,
          fontWeight: 900,
          fontFamily: "sans-serif",
        }}
      >
        D
      </div>
    ),
    { ...size },
  );
}
