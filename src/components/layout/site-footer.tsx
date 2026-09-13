import Link from "next/link";
import { BrandLogo } from "./brand-logo";

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="container footer-inner">
      <Link href="/" aria-label="SaaScan, accueil"><BrandLogo /></Link>
      <p>Le radar des SaaS qui marchent. Écrit à la main.</p>
      <nav aria-label="Informations légales"><Link href="/remboursement">Conditions de remboursement</Link><Link href="/cgv">CGV</Link><Link href="/confidentialite">Confidentialité</Link><Link href="/contact">Contact</Link><Link href="/mentions-legales">Mentions légales</Link></nav>
    </div>
  </footer>;
}
