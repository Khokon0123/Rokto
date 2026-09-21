import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // Edit links are secrets: keep them and the API out of search engines.
  return { rules: { userAgent: "*", allow: "/", disallow: ["/edit/", "/api/", "/recover"] } };
}
