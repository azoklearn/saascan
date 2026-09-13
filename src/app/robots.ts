import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/app", "/dossier/", "/questionnaire/", "/generation/", "/debloquer/"] }, sitemap: `${brand.url}/sitemap.xml` }; }
