import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// /sitemap.xml — the landing is a single page.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
}
