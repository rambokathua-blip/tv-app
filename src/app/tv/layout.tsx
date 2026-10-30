import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kathua Fresh - TV Player",
  description: "Smart Digital Signage Player for Kathua Fresh Store TV",
};

export default function TvLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#000",
        color: "#fff",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif',
        userSelect: "none",
        WebkitUserSelect: "none",
        cursor: "none",
      }}
    >
      {children}
    </div>
  );
}
