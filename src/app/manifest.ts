import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MYRAC Appointments",
    short_name: "MYRAC Citas",
    description: "Agenda de citas y bahías para talleres automotrices.",
    start_url: "/panel",
    display: "standalone",
    background_color: "#f6f6f7",
    theme_color: "#18181b",
    lang: "es-MX",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
