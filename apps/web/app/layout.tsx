import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3210"),
  title: { default: "Nia — the shop assistant who remembers your customers", template: "%s · Nia" },
  description:
    "Nia is an AI shopping and service assistant that remembers what your customers like, what they ordered, and how they prefer to buy — across web and Telegram. Powered by Walrus Memory.",
  applicationName: "Nia",
  icons: {
    icon: [{ url: "/brand/nia-icon.svg", type: "image/svg+xml" }, { url: "/brand/nia-icon-192.png", sizes: "192x192" }],
    apple: "/brand/apple-touch-icon.png",
  },
  openGraph: {
    title: "Nia — every customer deserves to feel remembered",
    description: "An AI shopping and service assistant with durable, customer-controlled memory on Walrus.",
    images: [{ url: "/brand/nia-icon-512.png", width: 512, height: 512 }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e13" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
