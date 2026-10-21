import type { Metadata, Viewport } from "next";
import { Geist_Mono, Space_Grotesk } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { BackgroundLines } from "@/components/layout/BackgroundLines";
import { SIGNUP_URL, X_URL } from "@/lib/nav";
import {
  SHARE_DESCRIPTION,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  STARTING_PRICE_USD,
} from "@/lib/seo";
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

// All copy comes from src/lib/seo.ts. The share image is NOT listed here: the
// opengraph-image.tsx / twitter-image.tsx files next to this layout add og:image and
// twitter:image (with width/height/alt) on their own.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "technology",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    title: SITE_TITLE,
    description: SHARE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    site: "@usectlcloud",
    creator: "@usectlcloud",
    title: SITE_TITLE,
    description: SHARE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#1e1d1d",
  colorScheme: "dark",
};

// Structured data (schema.org) — tells Google / AI search what this is: the organisation,
// the site, and the product with its starting price. `<` is escaped per the Next.js JSON-LD guide.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/logo/logo.svg`,
      email: "hello@usectl.com",
      sameAs: [X_URL],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: {
        "@type": "Offer",
        price: STARTING_PRICE_USD,
        priceCurrency: "USD",
        url: SIGNUP_URL,
      },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <BackgroundLines />
        <Header />
        {children}
      </body>
    </html>
  );
}
