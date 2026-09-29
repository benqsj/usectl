import type { Metadata } from "next";
import { Geist_Mono, Space_Grotesk } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { BackgroundLines } from "@/components/layout/BackgroundLines";
import "./globals.css";

// Only used by the mono panels/terminals, none of which is above the fold — no preload, so it
// doesn't compete with the hero's Space Grotesk on first load.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const siteName = "UseCTL";
const siteDescription = "TODO: Product description";
const siteUrl = "https://usectlcom";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: siteName,
    description: siteDescription,
    siteName,
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col bg-background text-foreground">
        <BackgroundLines />
        <Header />
        {children}
      </body>
    </html>
  );
}
