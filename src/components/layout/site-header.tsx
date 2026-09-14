"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { BrandLogo } from "./brand-logo";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    return () => data.subscription.unsubscribe();
  }, []);
  const close = () => setOpen(false);
  const account = signedIn ? { href: "/espace", label: "Mon espace" } : { href: "/connexion", label: "Se connecter" };
  return <header className="site-header">
    <div className="container header-inner">
      <Link href="/" aria-label="SaaScan, accueil" onClick={close}><BrandLogo /></Link>
      <div className="header-actions">
        <nav className="desktop-nav" aria-label="Navigation principale"><Link href="/#questions">Questions</Link><Link href={account.href}>{account.label}</Link></nav>
        <Link className="button button-small button-primary button-launch" href="/questionnaire">Lancer mon business</Link>
        <button className="menu-toggle" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X size={23} /> : <Menu size={23} />}</button>
      </div>
    </div>
    {open && <nav className="mobile-nav container" id="mobile-navigation" aria-label="Navigation mobile">
      <Link href="/#questions" onClick={close}>Questions<ArrowUpRight size={16} /></Link>
      <Link href={account.href} onClick={close}>{account.label}<ArrowUpRight size={16} /></Link>
      <Link href="/questionnaire" onClick={close}>Lancer mon business<ArrowUpRight size={16} /></Link>
    </nav>}
  </header>;
}
