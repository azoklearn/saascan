import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { brand } from "@/config/brand";
import "./scan-flow.css";

export type ScanStage = "intro" | "question" | "analysis" | "ready" | "offer" | "account";

export function ScanShell({ children, stage, demo = false, aside }: { children: ReactNode; stage: ScanStage; demo?: boolean; aside?: ReactNode }) {
  return <main className="scan-shell" data-stage={stage}>
    {(stage === "question" || stage === "offer") && <header className="scan-header"><Link href="/" aria-label={`${brand.name}, accueil`}><BrandLogo /></Link>{aside}</header>}
    {demo && <p className="scan-demo-note">Démonstration · Aucun paiement</p>}
    <div className="scan-content">{children}</div>
    <footer className="scan-footer"><span>© {brand.name}</span><Link href="/cgv">CGV</Link><Link href="/confidentialite">Confidentialité</Link><Link href="/contact">Contact</Link></footer>
  </main>;
}

export function ScanError({ children }: { children: ReactNode }) {
  return <div className="scan-error" role="alert">{children}</div>;
}
