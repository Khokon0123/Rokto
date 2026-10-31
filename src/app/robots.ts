import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  // Edit links are secrets; admin and the API are not for search engines (L5).
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/edit", "/edit/", "/api/", "/recover", "/admin"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
