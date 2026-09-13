import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { FAQ } from "@/components/landing/faq";
import { HeroDecor } from "@/components/landing/hero-decor";
import { PaymentsPhone } from "@/components/landing/payments-phone";
import { ideas } from "@/lib/matching/filters";
import { questions } from "@/lib/questionnaire/questions";

const tools = ["Supabase", "GitHub", "Stripe", "Whop", "TikTok", "Claude"];

const stats = [
  [String(ideas.length), "idées en banque, rédigées et taguées"],
  [String(questions.length), "questions sur votre situation réelle"],
  ["~800", "mots de prompt, prêt à coller"],
  ["30", "jours de plan, semaine par semaine"],
];

export default function HomePage() {
  return <main className="landing-page">
    <HeroDecor />
    <section className="hero container">
      <div className="hero-copy">
        <div className="hero-eyebrow"><span className="status-dot" /> LE RADAR DES SAAS QUI MARCHENT</div>
        <h1>Créez votre premier<br className="desktop-break" /> business <span>et obtenez<br className="desktop-break" /> vos premiers revenus.</span></h1>
        <p className="hero-description">Trouvez l’idée de votre premier site, mettez-le en ligne et <strong>encaissez vos premiers paiements.</strong></p>
        <div className="hero-actions"><Link href="/questionnaire" className="button button-primary button-large">Créer mon SaaS <ArrowRight size={18} /></Link></div>
      </div>
      <PaymentsPhone />
    </section>

    <section className="tools-section" aria-label="Les outils sur lesquels vous allez construire"><div className="container"><p className="tools-intro">LES OUTILS SUR LESQUELS VOUS ALLEZ CONSTRUIRE</p></div><div className="tools-marquee"><div className="tools-track">{[false, true].map((duplicate) => <div className="tools-set" key={String(duplicate)} aria-hidden={duplicate || undefined}>{tools.map((tool) => <span key={tool}>{tool}</span>)}</div>)}</div></div></section>

    <section className="container stats-section" aria-label="En chiffres"><Reveal><div className="stats-row">{stats.map(([number, label]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}</div></Reveal></section>

    <section className="section container faq-section" id="questions">
      <Reveal><div className="faq-intro"><p className="eyebrow"><span className="tiny-square" /> OBJECTIONS</p><h2>Les questions qu’on<br /> nous pose souvent</h2></div></Reveal>
      <Reveal><FAQ /></Reveal>
    </section>
  </main>;
}
