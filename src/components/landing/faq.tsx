"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const items = [
  ["Les idées ne sont pas « prises » si tout le monde les voit ?", "La banque d’idées est commune, mais ton dossier ne l’est pas : les trois pistes sont retenues et argumentées à partir de tes réponses, et le prompt comme le plan sont écrits pour ta situation. Une idée n’a pas besoin d’être inédite pour être utile. Ce qui compte, c’est un problème précis, une cible que tu peux atteindre et une version que tu es capable de construire. La première semaine du plan sert justement à tester le besoin auprès de vrais clients."],
  ["Je ne sais pas coder. Le prompt me sert à quoi ?", "C’est prévu dans le questionnaire : les idées trop techniques pour ton niveau sont écartées. Le prompt décrit ton produit en environ 800 mots : le parcours, les données, les outils et le paiement. Tu le colles dans un outil guidé comme Lovable ou Claude Code, qui construit la première version avec toi. Il faudra apprendre et tester, mais tu n’as pas besoin de devenir développeur avant de commencer."],
  ["Pourquoi autant de questions ? C’est long.", "Compte environ 5 minutes. Chaque réponse sert à écarter ce qui ne te correspond pas : ton budget, ton temps, ton niveau technique, ta langue et les canaux que tu peux utiliser. Tes réponses sont ensuite citées dans ton dossier pour expliquer chaque piste. Et tu n’as pas à tout faire d’un coup : ta progression est enregistrée, tu reprends quand tu veux."],
  ["Pourquoi seulement 3 idées et pas 50 ?", "Parce qu’une liste de 50 idées, tu l’as sûrement déjà dans tes notes. Trois pistes, c’est assez pour choisir sans te disperser. Elles sont classées et argumentées, et la première reçoit un prompt de construction et un plan détaillé pour passer tout de suite à l’étape suivante."],
  ["Pourquoi me demander de créer un compte ?", "Pour retrouver ton questionnaire là où tu l’as laissé, conserver ton dossier et suivre ton plan. La connexion se fait par un lien envoyé à ton adresse email : aucun mot de passe à retenir."],
];

export function FAQ() {
  const [active, setActive] = useState<number | null>(null);
  return <div className="faq-list">{items.map(([question, answer], index) => <div className={`faq-item ${active === index ? "is-open" : ""}`} key={question}>
    <h3><button id={`faq-button-${index}`} aria-expanded={active === index} aria-controls={`faq-answer-${index}`} onClick={() => setActive(active === index ? null : index)}>{question}<span><ChevronDown size={20} strokeWidth={1.5} /></span></button></h3>
    <div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-button-${index}`} hidden={active !== index}><p>{answer}</p></div>
  </div>)}</div>;
}
