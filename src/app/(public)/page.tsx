import Link from "next/link";
import { ArrowRight, BatteryFull, SignalHigh, Wifi } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { FAQ } from "@/components/landing/faq";
import { HeroDecor } from "@/components/landing/hero-decor";

const payments = [
  { amount: "39,00 €", sender: "xxxxxx@hotmail.fr", time: "maintenant" },
  { amount: "149,00 €", sender: "xxxxxx@icloud.com", time: "il y a 1 min" },
  { amount: "79,98 €", sender: "xxxxxxx@outlook.fr", time: "il y a 2 min" },
];

const tools = ["Supabase", "GitHub", "Stripe", "Whop", "TikTok", "Claude"];

const stats = [
  ["20", "idées en banque, rédigées et taguées"],
  ["20", "questions sur ta situation réelle"],
  ["~800", "mots de prompt, prêt à coller"],
  ["30", "jours de plan, semaine par semaine"],
];

export default function HomePage() {
  return <main className="landing-page">
    <HeroDecor />
    <section className="hero container">
      <div className="hero-copy">
        <div className="hero-eyebrow"><span className="status-dot" /> LE RADAR DES SAAS QUI MARCHENT</div>
        <h1>Crée ton premier<br className="desktop-break" /> business <span>et obtiens<br className="desktop-break" /> tes premiers revenus.</span></h1>
        <p className="hero-description">Trouve l’idée de ton premier site, mets-le en ligne et <strong>encaisse tes premiers paiements.</strong></p>
        <div className="hero-actions"><Link href="/connexion" className="button button-primary button-large">Créer mon SaaS <ArrowRight size={18} /></Link></div>
      </div>
      <figure className="payments-scene">
        <div className="payments-phone" role="img" aria-label="Illustration : notifications de paiement Stripe sur un téléphone">
          <div className="phone-screen">
            <div className="phone-status"><span>9:41</span><span className="phone-island" /><span className="phone-indicators"><SignalHigh size={13} /><Wifi size={13} /><BatteryFull size={17} /></span></div>
            <p className="phone-clock">9:41</p>
            <ul className="payment-stack">{payments.map(({ amount, sender, time }) => <li className="payment-card" key={amount}><span className="payment-app">S</span><div><p className="payment-head"><strong>Stripe</strong><span>{time}</span></p><p className="payment-text">Vous avez reçu un paiement d’un montant de <strong>{amount}</strong> émis par {sender}</p></div></li>)}</ul>
          </div>
        </div>
        <figcaption>ILLUSTRATION</figcaption>
      </figure>
    </section>

    <section className="tools-section" aria-label="Les outils sur lesquels tu vas construire"><div className="container"><p className="tools-intro">LES OUTILS SUR LESQUELS TU VAS CONSTRUIRE</p></div><div className="tools-marquee"><div className="tools-track">{[false, true].map((duplicate) => <div className="tools-set" key={String(duplicate)} aria-hidden={duplicate || undefined}>{tools.map((tool) => <span key={tool}>{tool}</span>)}</div>)}</div></div></section>

    <section className="container stats-section" aria-label="En chiffres"><Reveal><div className="stats-row">{stats.map(([number, label]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}</div></Reveal></section>

    <section className="section container faq-section" id="questions">
      <Reveal><div className="faq-intro"><p className="eyebrow"><span className="tiny-square" /> OBJECTIONS</p><h2>Les questions qu’on<br /> nous pose souvent</h2></div></Reveal>
      <Reveal><FAQ /></Reveal>
    </section>
  </main>;
}
