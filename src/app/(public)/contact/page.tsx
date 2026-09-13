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
      <section className="contact-card"><Mail size={25} /><h2>Écrivez-nous.</h2><p>Indiquez l’adresse email utilisée lors du paiement et décrivez votre demande. Ces informations suffisent pour retrouver votre dossier.</p>{brand.email ? <a className="button button-secondary" href={`mailto:${brand.email}`}>{brand.email}<ArrowUpRight size={15} /></a> : <p className="contact-pending">Le service est en préparation. L’adresse de contact sera publiée avant l’ouverture des achats.</p>}</section>
      <section className="contact-card"><ShieldCheck size={25} /><h2>Vous souhaitez un remboursement ?</h2><p>La garantie de 48 heures vous permet de demander le remboursement directement depuis votre dossier.</p><Link className="button button-secondary" href="/remboursement">Consulter la garantie <ArrowUpRight size={15} /></Link></section>
    </div>
    <h2>Une réponse se trouve peut-être déjà ici.</h2>
    <p>Consultez les <Link href="/#questions">questions fréquentes</Link> pour comprendre le fonctionnement du questionnaire, du prompt et du dossier.</p>
  </main>;
}
