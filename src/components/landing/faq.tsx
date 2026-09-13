"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { questions } from "@/lib/questionnaire/questions";

const items = [
  ["Les idées ne sont pas « prises » si tout le monde les voit ?", "La banque d’idées est commune, mais votre dossier ne l’est pas : les trois pistes sont retenues et argumentées à partir de vos réponses, et le prompt comme le plan sont écrits pour votre situation. Une idée n’a pas besoin d’être inédite pour être utile. Ce qui compte, c’est un problème précis, une cible que vous pouvez atteindre et une version que vous êtes capable de construire. La première semaine du plan sert justement à tester le besoin auprès de vrais clients."],
  ["Je ne sais pas coder. Le prompt me sert à quoi ?", "Le questionnaire tient compte de ce que vous savez faire seul. Le prompt décrit votre produit en environ 800 mots : le parcours, les données, les outils et le paiement. Vous le collez dans un outil guidé comme Lovable ou Claude Code, qui construit la première version avec vous, ou vous le confiez à un associé technique. Il faudra apprendre et tester, mais vous n’avez pas besoin de devenir développeur avant de commencer."],
  ["Pourquoi autant de questions ? C’est long.", `${questions.length} questions, environ deux minutes. Chaque réponse oriente la sélection : à qui vendre, vos domaines, ce que vous savez construire, votre temps, votre zone, votre modèle de facturation, votre rapport à la concurrence et votre objectif de revenu. Vos réponses restent dans votre navigateur jusqu’au paiement.`],
  ["Pourquoi seulement 3 idées et pas 50 ?", "Parce qu’une liste de 50 idées, vous l’avez sûrement déjà dans vos notes. Trois pistes, c’est assez pour choisir sans vous disperser. Elles sont classées et argumentées, et la première reçoit un prompt de construction et un plan détaillé pour passer tout de suite à l’étape suivante."],
  ["Faut-il créer un compte ?", "Non. Vous répondez au questionnaire sans inscription. Après le paiement, votre dossier s’ouvre directement et un lien personnel vous est envoyé par email pour le retrouver quand vous voulez."],
];

export function FAQ() {
  const [active, setActive] = useState<number | null>(null);
  return <div className="faq-list">{items.map(([question, answer], index) => <div className={`faq-item ${active === index ? "is-open" : ""}`} key={question}>
    <h3><button id={`faq-button-${index}`} aria-expanded={active === index} aria-controls={`faq-answer-${index}`} onClick={() => setActive(active === index ? null : index)}>{question}<span><ChevronDown size={20} strokeWidth={1.5} /></span></button></h3>
    <div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-button-${index}`} hidden={active !== index}><p>{answer}</p></div>
  </div>)}</div>;
}
