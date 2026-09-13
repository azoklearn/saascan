import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteChrome } from "@/components/layout/site-chrome";
import { brand } from "@/config/brand";
import "./globals.css";
import "./reference-theme.css";

export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: { default: `${brand.name} — Une idée qui te correspond. Un plan pour la lancer.`, template: `%s · ${brand.name}` },
  description: brand.description,
  openGraph: { title: `${brand.name} — Le scanner d’idées de SaaS`, description: brand.description, locale: "fr_FR", type: "website" },
  robots: { index: true, follow: true },
  icons: { icon: "/brand/icon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1115", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body><a className="skip-link" href="#main-content">Aller au contenu</a><SiteChrome><SiteHeader /></SiteChrome><div id="main-content">{children}</div><SiteChrome><SiteFooter /></SiteChrome></body></html>;
}
