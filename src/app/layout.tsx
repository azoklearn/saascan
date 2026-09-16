import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteChrome } from "@/components/layout/site-chrome";
import { SiteAnalytics } from "@/components/layout/site-analytics";
import { brand } from "@/config/brand";
import "./globals.css";
import "./reference-theme.css";

export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: { default: `${brand.name} — Une idée qui vous correspond. Un plan pour la lancer.`, template: `%s · ${brand.name}` },
  description: brand.description,
  openGraph: { title: `${brand.name} — ${brand.tagline}`, description: brand.description, locale: "fr_FR", type: "website" },
  robots: { index: true, follow: true },
  icons: { icon: "/brand/icon.svg" },
};
// Whop Pixel (docs.whop.com/developer/ads/pixel), recopié sans modification dans le <head> de chaque page.
// Le script suit lui-même les navigations internes ; Whop compte les paiements côté serveur.
const whopPixel = String.raw`!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope("biz_CNNc2c0v2u6uxe");whop.track("page");`;

export const viewport: Viewport ={ width: "device-width", initialScale: 1, themeColor: "#0b1115", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><head><script dangerouslySetInnerHTML={{ __html: whopPixel }} /></head><body><a className="skip-link" href="#main-content">Aller au contenu</a><SiteChrome><SiteHeader /></SiteChrome><div id="main-content">{children}</div><SiteChrome><SiteFooter /></SiteChrome><SiteAnalytics /></body></html>;
}
