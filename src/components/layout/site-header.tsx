"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { rememberedDossier } from "@/lib/dossier/saved-link";
import { BrandLogo } from "./brand-logo";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [dossierHref, setDossierHref] = useState<string | null>(null);
  useEffect(() => { const token = rememberedDossier(); if (token) setDossierHref(`/dossier/${token}`); }, []);
  const close = () => setOpen(false);
  return <header className="site-header">
    <div className="container header-inner">
      <Link href="/" aria-label="SaaScan, accueil" onClick={close}><BrandLogo /></Link>
      <div className="header-actions">
        <nav className="desktop-nav" aria-label="Navigation principale">{dossierHref && <Link href={dossierHref}>Mon dossier</Link>}<Link href="/#questions">Questions</Link></nav>
        <Link className="button button-small button-primary" href="/questionnaire">Créer mon SaaS</Link>
        <button className="menu-toggle" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X size={23} /> : <Menu size={23} />}</button>
      </div>
    </div>
    {open && <nav className="mobile-nav container" id="mobile-navigation" aria-label="Navigation mobile">
      {dossierHref && <Link href={dossierHref} onClick={close}>Mon dossier<ArrowUpRight size={16} /></Link>}
      <Link href="/#questions" onClick={close}>Questions<ArrowUpRight size={16} /></Link>
      <Link href="/questionnaire" onClick={close}>Créer mon SaaS<ArrowUpRight size={16} /></Link>
    </nav>}
  </header>;
}
