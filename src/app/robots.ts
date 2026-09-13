import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/questionnaire", "/analyse", "/debloquer", "/dossier/"] }, sitemap: `${brand.url}/sitemap.xml` }; }
