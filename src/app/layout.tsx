import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kathua Fresh TV",
  description: "Smart Digital Signage Platform for Kathua Fresh Store TV",
  applicationName: "Kathua Fresh TV",
  appleWebApp: {
    capable: true,
    title: "Kathua Fresh TV",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/kathua-fresh-logo.jpg" },
      { url: "/icon.png" },
    ],
    shortcut: "/kathua-fresh-logo.jpg",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/kathua-fresh-logo.jpg" },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
