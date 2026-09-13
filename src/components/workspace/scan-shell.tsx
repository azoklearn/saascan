import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { brand } from "@/config/brand";
import "./scan-flow.css";

export type ScanStage = "intro" | "question" | "analysis" | "ready" | "offer";

export function ScanShell({ children, demo = false, stage = "question", wide = false }: { children: ReactNode; demo?: boolean; stage?: ScanStage; wide?: boolean }) {
  return <main className="scan-shell" data-stage={stage}>
    <header className="scan-header">
      <Link href="/" aria-label={`${brand.name}, accueil`}><BrandLogo /></Link>
      <Link href="/">← Retour à l’accueil</Link>
    </header>
    {demo && <p className="scan-demo-note">Démonstration · Aucun paiement ni appel à l’IA</p>}
    <div className="scan-content" data-wide={wide}>{children}</div>
    <footer className="scan-footer">
      <span>{brand.name}</span>
      <p>{demo ? "Tes réponses restent dans ce navigateur." : "Ton dossier est sauvegardé dans ton espace."}</p>
      <nav aria-label="Informations du questionnaire"><Link href="/remboursement">Conditions de remboursement</Link><Link href="/mentions-legales">Mentions légales</Link></nav>
    </footer>
  </main>;
}

export function ScanError({ children }: { children: ReactNode }) {
  return <div className="scan-error" role="alert">{children}</div>;
}
