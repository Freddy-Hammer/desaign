import { ImageResponse } from "next/og";

// Home-screen icon for iOS "Add to Home Screen" (180×180 is the standard).
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
          background: "#475240",
          color: "#ffffff",
          fontSize: 120,
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
