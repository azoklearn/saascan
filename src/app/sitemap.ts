import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
export default function sitemap(): MetadataRoute.Sitemap { return ["", "/contact", "/cgv"].map(path => ({ url: `${brand.url}${path}`, changeFrequency: "monthly", priority: path ? 0.3 : 1 })); }
