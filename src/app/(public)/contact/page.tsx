import Link from "next/link";
import { ArrowUpRight, Mail, ShieldCheck } from "lucide-react";
import { brand } from "@/config/brand";

export const metadata = { title: "Contact" };

export default function Page() {
  return <main className="container legal-page">
    <p className="eyebrow">UNE QUESTION, UN BLOCAGE ?</p>
    <h1>On garde le contact.</h1>
    <p className="legal-intro">Une question avant de commencer, un dossier à retrouver ou une difficulté technique : voici comment nous joindre.</p>
    <div className="contact-cards">
      <section className="contact-card"><Mail size={25} /><h2>Écris-nous.</h2><p>Indique l’adresse de ton compte et la référence du dossier concerné. Ces informations suffisent pour retrouver ta demande.</p>{brand.email ? <a className="button button-secondary" href={`mailto:${brand.email}`}>{brand.email}<ArrowUpRight size={15} /></a> : <p className="contact-pending">Le service est en préparation. L’adresse de contact sera publiée avant l’ouverture des achats.</p>}</section>
      <section className="contact-card"><ShieldCheck size={25} /><h2>Tu souhaites un remboursement ?</h2><p>La garantie de 48 heures te permet de retrouver ton achat et de demander son remboursement depuis ton compte.</p><Link className="button button-secondary" href="/remboursement">Consulter la garantie <ArrowUpRight size={15} /></Link></section>
    </div>
    <h2>Une réponse se trouve peut-être déjà ici.</h2>
    <p>Consulte les <Link href="/#questions">questions fréquentes</Link> pour comprendre le fonctionnement du scan, du prompt et du dossier.</p>
  </main>;
}
