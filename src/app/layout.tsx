import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MYRAC Appointments — Citas para talleres",
    template: "%s · MYRAC Appointments",
  },
  description:
    "Agenda en línea para talleres automotrices: tus clientes reservan en los horarios con espacio real y tú controlas citas y bahías desde cualquier dispositivo.",
  applicationName: "MYRAC Appointments",
  appleWebApp: { capable: true, title: "MYRAC Citas", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#18181b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
