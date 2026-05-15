import { ImageResponse } from "next/og";

// Browser/tab favicon — generated, so it stays crisp at any size and needs
// no asset file. Replaces the default Next.js favicon.ico.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 340,
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
