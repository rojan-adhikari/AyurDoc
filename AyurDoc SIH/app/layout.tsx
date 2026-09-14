import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AyurDoc",
  description:
    "AyurDoc is a consent-first, multilingual Ayurvedic case-taking and teleconsultation portal.",
  applicationName: "AyurDoc",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AyurDoc",
  },
  icons: {
    icon: "/ayurdoc-icon.svg",
    shortcut: "/ayurdoc-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#126f66",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
