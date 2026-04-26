import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "DesAIgn",
  description: "Curated design and AI signals worth your attention.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <Script
          src="https://t.contentsquare.net/uxa/2b523691042fe.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
