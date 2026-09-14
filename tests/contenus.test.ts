import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Answers, Idea } from "@/types/domain";
import { buildPrompt, demoAnswers, videoPlatforms, type IdeaContent } from "@/lib/dossier/content";
import { countWords } from "@/lib/dossier/word-count";
import { ideas } from "@/lib/matching/filters";
import { buildProfile } from "@/lib/questionnaire/profile";

// Contrôle les textes rédigés à l’avance. Pour une seule idée : npx vitest run tests/contenus.test.ts -t <id>
export const roadmapPeriods = ["Mois 1", "Mois 2", "Mois 3", "Mois 4 à 5", "Mois 6 à 7", "Mois 8 à 10", "Mois 11 à 12"];
const placeholders = ["{objectif_revenu}", "{heures_par_semaine}"];

const variants: Answers[] = [];
for (const competences of ["application", "interface", "sans_code", "aucune"])
  for (const zone of ["francophone", "anglophone", "europe", "mondial"])
    for (const facturation of ["abonnement", "usage", "licence", "indifferent"])
      for (const cible_client of ["b2b", "b2c", "decide"])
        for (const tranche_age of ["25_34", "moins_18"])
          for (const temps_jour of ["moins_1h", "1h", "2_3h", "journee"])
            for (const objectif_revenu of ["300", "50000"])
              variants.push({ ...demoAnswers, competences, zone, facturation, cible_client, tranche_age, temps_jour, objectif_revenu });
const profiles = variants.map(buildProfile);

const chars = (label: string, text: unknown, min: number, max: number) =>
  typeof text !== "string" ? [`${label} : texte manquant`] : text.length < min || text.length > max ? [`${label} : ${text.length} caractères, attendu ${min} à ${max}`] : [];
const wordRange = (label: string, text: unknown, min: number, max: number) =>
  typeof text !== "string" ? [`${label} : texte manquant`] : countWords(text) < min || countWords(text) > max ? [`${label} : ${countWords(text)} mots, attendu ${min} à ${max}`] : [];
const count = (label: string, list: unknown, min: number, max: number) =>
  !Array.isArray(list) ? [`${label} : liste manquante`] : list.length < min || list.length > max ? [`${label} : ${list.length} éléments, attendu ${min} à ${max}`] : [];
const keys = (label: string, value: object, expected: string[]) =>
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()) ? [] : [`${label} : clés ${Object.keys(value).join(", ")}, attendu ${expected.join(", ")}`];
const normalize = (text: string) => text.toLocaleLowerCase("fr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function style(label: string, text: string, { allowPlaceholders = false, allowPercent = true } = {}): string[] {
  const issues: string[] = [];
  if (text !== text.trim() || /\s{2,}/.test(text)) issues.push(`${label} : espaces en trop`);
  if (text.includes("'")) issues.push(`${label} : apostrophe droite, utilisez ’`);
  if (/(^|[^\p{L}’])(tu|ton|ta|tes|toi|te)(?![\p{L}’])/iu.test(text) || /(^|[^\p{L}])t’/iu.test(text)) issues.push(`${label} : tutoiement, vouvoyez`);
  if ((text.match(/\{[^}]*\}/g) ?? []).some((tag) => !allowPlaceholders || !placeholders.includes(tag))) issues.push(`${label} : balise non autorisée`);
  if (/[<>]|TODO|lorem|\.\.\./i.test(text)) issues.push(`${label} : texte provisoire ou caractère interdit`);
  // Contenus pour le grand public : aucun jargon de startup.
  const jargon = text.match(/\b(MVP|churn|onboarding|B2B|B2C|KPI|funnel|growth|leads?|SaaS)\b/i);
  if (jargon) issues.push(`${label} : jargon « ${jargon[0]} », dites-le avec des mots simples`);
  if (!allowPercent && text.includes("%")) issues.push(`${label} : pourcentage, n’inventez aucun chiffre`);
  return issues;
}

const load = (id: string) => JSON.parse(readFileSync(`data/contenus/${id}.json`, "utf8")) as IdeaContent;

describe.each(ideas.map((idea) => [idea.id, idea] as [string, Idea]))("Contenu rédigé %s", (id, idea) => {
  const path = `data/contenus/${id}.json`;

  it(`${id} · fichier, risque, prompt et construction`, () => {
    expect(existsSync(path), `${path} est manquant`).toBe(true);
    const content = load(id);
    const issues = [
      ...keys("racine", content, ["idea_id", "risque", "prompt", "construction", "videos", "roadmap"]),
      ...(content.idea_id === id ? [] : ["idea_id différent du nom du fichier"]),
      ...chars("risque", content.risque, 150, 600), ...style("risque", content.risque ?? ""),
      ...keys("prompt", content.prompt ?? {}, ["produit", "ecrans", "donnees", "criteres"]),
      ...wordRange("prompt.produit", content.prompt?.produit, 60, 130), ...style("prompt.produit", content.prompt?.produit ?? ""),
      ...count("prompt.ecrans", content.prompt?.ecrans, 5, 6),
      ...(content.prompt?.ecrans ?? []).flatMap((screen, index) => [...wordRange(`prompt.ecrans[${index}]`, screen, 15, 50), ...style(`prompt.ecrans[${index}]`, screen)]),
      ...wordRange("prompt.donnees", content.prompt?.donnees, 45, 110), ...style("prompt.donnees", content.prompt?.donnees ?? ""),
      ...count("prompt.criteres", content.prompt?.criteres, 4, 6),
      ...(content.prompt?.criteres ?? []).flatMap((criterion, index) => [...wordRange(`prompt.criteres[${index}]`, criterion, 8, 30), ...style(`prompt.criteres[${index}]`, criterion)]),
      ...count("construction", content.construction, 4, 4),
      ...(content.construction ?? []).flatMap((task, index) => [...chars(`construction[${index}]`, task, 50, 260), ...style(`construction[${index}]`, task)]),
    ];
    expect(issues).toEqual([]);
  });

  it(`${id} · prompt de 700 à 900 mots pour chaque profil`, () => {
    const content = load(id);
    let min = Infinity; let max = 0;
    for (const profile of profiles) {
      const words = countWords(buildPrompt(idea, content, profile));
      min = Math.min(min, words); max = Math.max(max, words);
    }
    console.info(`${id} · prompt de ${min} à ${max} mots selon les profils`);
    expect({ min, max }, `le prompt va de ${min} à ${max} mots selon les profils`).toSatisfy(({ min: low, max: high }: { min: number; max: number }) => low >= 700 && high <= 900);
  });

  it(`${id} · 60 idées de vidéos distinctes`, () => {
    const { videos } = load(id);
    const issues = [
      ...count("videos", videos, 60, 60),
      ...(videos ?? []).flatMap((video, index) => [
        ...keys(`videos[${index}]`, video, ["plateforme", "format", "accroche", "deroule", "appel_action"]),
        ...((videoPlatforms as readonly string[]).includes(video.plateforme) ? [] : [`videos[${index}].plateforme inconnue : ${video.plateforme}`]),
        ...chars(`videos[${index}].format`, video.format, 3, 40),
        ...chars(`videos[${index}].accroche`, video.accroche, 15, 160),
        ...chars(`videos[${index}].deroule`, video.deroule, 150, 650),
        ...chars(`videos[${index}].appel_action`, video.appel_action, 15, 200),
        ...[video.format, video.accroche, video.deroule, video.appel_action].flatMap((text) => style(`videos[${index}]`, text ?? "", { allowPercent: false })),
      ]),
    ];
    const hooks = (videos ?? []).map((video) => normalize(video.accroche ?? ""));
    const duplicates = hooks.filter((hook, index) => hooks.indexOf(hook) !== index);
    if (duplicates.length) issues.push(`accroches répétées : ${duplicates.join(" | ")}`);
    const plans = (videos ?? []).map((video) => normalize(video.deroule ?? ""));
    if (new Set(plans).size !== plans.length) issues.push("déroulés répétés");
    if (new Set((videos ?? []).map((video) => video.plateforme)).size < 3) issues.push("au moins trois plateformes attendues");
    const firstThirty = (videos ?? []).slice(0, 30);
    if (new Set(firstThirty.map((video) => video.plateforme)).size < 2) issues.push("les 30 premières vidéos doivent varier les plateformes");
    if (new Set(firstThirty.map((video) => normalize(video.format ?? ""))).size < 8) issues.push("les 30 premières vidéos doivent utiliser au moins huit formats");
    expect(issues).toEqual([]);
  });

  it(`${id} · plan de A à Z en sept phases`, () => {
    const { roadmap } = load(id);
    const issues = [
      ...count("roadmap", roadmap, 7, 7),
      ...(roadmap ?? []).flatMap((phase, index) => [
        ...keys(`roadmap[${index}]`, phase, ["titre", "periode", "objectif", "actions", "indicateur"]),
        ...(phase.periode === roadmapPeriods[index] ? [] : [`roadmap[${index}].periode : « ${phase.periode} », attendu « ${roadmapPeriods[index]} »`]),
        ...chars(`roadmap[${index}].titre`, phase.titre, 8, 70),
        ...chars(`roadmap[${index}].objectif`, phase.objectif, 60, 400),
        ...count(`roadmap[${index}].actions`, phase.actions, 3, 5),
        ...(phase.actions ?? []).flatMap((action, actionIndex) => chars(`roadmap[${index}].actions[${actionIndex}]`, action, 30, 260)),
        ...chars(`roadmap[${index}].indicateur`, phase.indicateur, 30, 240),
        ...[phase.titre, phase.objectif, phase.indicateur, ...(phase.actions ?? [])].flatMap((text) => style(`roadmap[${index}]`, text ?? "", { allowPlaceholders: true, allowPercent: false })),
      ]),
    ];
    if (!JSON.stringify(roadmap ?? []).includes("{objectif_revenu}")) issues.push("le plan doit citer {objectif_revenu} au moins une fois");
    expect(issues).toEqual([]);
  });
});
