import Link from "next/link";
import { ArrowLeft, ScanLine } from "lucide-react";

export default function NotFound() { return <main className="empty-page container"><ScanLine size={42} /><p className="eyebrow">ERREUR 404</p><h1>Cette piste mène<br />à une page introuvable.</h1><p>Reviens à l’accueil pour retrouver le bon chemin.</p><Link className="button button-primary" href="/"><ArrowLeft size={17} /> Retour à l’accueil</Link></main>; }
