import type { Metadata } from "next";
import "./globals.css";
import { ChunkReload } from "@/components/chunk-reload";

export const metadata: Metadata = {
  title: { default: "Zyntomax", template: "%s · Zyntomax" },
  description: "Zyntomax Ventures operations platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Progressive enhancement: brand fonts load if reachable, otherwise
            the page falls back to the system stack (no build-time dependency
            on Google Fonts, so the app works offline / on flaky networks). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Fira+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ChunkReload />
        {children}
      </body>
    </html>
  );
}
