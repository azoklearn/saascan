"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Le lien d’un dossier ouvre son contenu : il n’est jamais envoyé aux statistiques, pas plus que les paramètres d’adresse.
function redact(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.pathname = url.pathname.replace(/^\/dossier\/([^/]+)/, (path, lien: string) => lien === "demo" ? path : "/dossier/[lien]");
  url.search = "";
  return { ...event, url: url.toString() };
}

export function SiteAnalytics() {
  return <Analytics beforeSend={redact} />;
}
