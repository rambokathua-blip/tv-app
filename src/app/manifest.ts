import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kathua Fresh TV",
    short_name: "Kathua Fresh",
    description: "Smart Digital Signage Platform for Kathua Fresh Store TV",
    start_url: "/",
    display: "standalone",
    background_color: "#021a12",
    theme_color: "#22c55e",
    icons: [
      {
        src: "/kathua-fresh-logo.jpg",
        sizes: "192x192",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/kathua-fresh-logo.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
  };
}
