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
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/brand/nia-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/nia-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
  openGraph: {
    title: "Nia — every customer deserves to feel remembered",
    description: "An AI shopping and service assistant with durable, customer-controlled memory on Walrus.",
    images: [{ url: "/brand/nia-og.jpg", width: 1200, height: 630, alt: "Nia, the walrus shop assistant" }],
  },
  twitter: { card: "summary_large_image", images: ["/brand/nia-og.jpg"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5fd" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0e26" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
