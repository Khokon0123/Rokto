import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rokto - রক্ত",
    short_name: "Rokto",
    description: "Find a blood donor in Chittagong by blood group and area.",
    start_url: "/search",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#b91c1c",
    lang: "bn",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
