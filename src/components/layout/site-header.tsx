"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { BrandLogo } from "./brand-logo";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((session) => setSignedIn(Boolean(session?.user)))
      .catch(() => {});
  }, []);
  const close = () => setOpen(false);
  return <header className="site-header">
    <div className="container header-inner">
      <Link href="/" aria-label="SaaScan, accueil" onClick={close}><BrandLogo /></Link>
      <div className="header-actions">
        <nav className="desktop-nav" aria-label="Navigation principale"><Link href="/#questions">Questions</Link></nav>
        {signedIn ? <>
          <Link className="button button-small button-secondary header-account" href="/app">Mon espace</Link>
          <form className="header-logout" action="/auth/deconnexion" method="post"><button className="header-login" type="submit">Se déconnecter</button></form>
        </> : <Link className="header-login" href="/connexion">Se connecter</Link>}
        <Link className="button button-small button-primary" href={signedIn ? "/app" : "/connexion"}>Créer mon SaaS</Link>
        <button className="menu-toggle" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X size={23} /> : <Menu size={23} />}</button>
      </div>
    </div>
    {open && <nav className="mobile-nav container" id="mobile-navigation" aria-label="Navigation mobile">
      <Link href="/#questions" onClick={close}>Questions<ArrowUpRight size={16} /></Link>
      {signedIn ? <>
        <Link href="/app" onClick={close}>Mon espace<ArrowUpRight size={16} /></Link>
        <form action="/auth/deconnexion" method="post"><button type="submit">Se déconnecter<ArrowUpRight size={16} /></button></form>
      </> : <Link href="/connexion" onClick={close}>Se connecter<ArrowUpRight size={16} /></Link>}
    </nav>}
  </header>;
}
