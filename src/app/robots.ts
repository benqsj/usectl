import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// /robots.txt — everything is public except the subscribe endpoint.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
