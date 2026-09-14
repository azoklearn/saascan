import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { FAQ } from "@/components/landing/faq";
import { HeroDecor } from "@/components/landing/hero-decor";
import { PaymentsPhone } from "@/components/landing/payments-phone";

export default function HomePage() {
  return <main className="landing-page">
    <HeroDecor />
    <section className="hero container">
      <div className="hero-copy">
        <div className="hero-eyebrow"><span className="status-dot" /> LE RADAR DES SAAS QUI MARCHENT</div>
        <h1>Créez votre premier<br className="desktop-break" /> business <span>et obtenez<br className="desktop-break" /> vos premiers revenus.</span></h1>
        <p className="hero-description">Trouvez l’idée de votre premier site, mettez-le en ligne et <strong>encaissez vos premiers paiements.</strong></p>
        <div className="hero-actions"><Link href="/questionnaire" className="button button-primary button-large button-launch">Lancer mon business <ArrowRight size={18} /></Link></div>
      </div>
      <PaymentsPhone />
    </section>

    <section className="section container faq-section" id="questions">
      <Reveal><div className="faq-intro"><p className="eyebrow"><span className="tiny-square" /> OBJECTIONS</p><h2>Les questions qu’on<br /> nous pose souvent</h2></div></Reveal>
      <Reveal><FAQ /></Reveal>
    </section>
  </main>;
}
