import { describe, expect, it } from "vitest";
import type { Answers } from "@/types/domain";
import { questions } from "@/lib/questionnaire/questions";
import { isComplete, validateAnswer, validateAnswers } from "@/lib/questionnaire/schemas";
import { buildProfile } from "@/lib/questionnaire/profile";
import { ideas, rejectionReasons } from "@/lib/matching/filters";
import { matchIdeas } from "@/lib/matching/scoring";
import { acquisitionFor, allowedChannels, ideaRules } from "@/lib/matching/idea-rules";
import { demoAnswers, generateDemoContent } from "@/lib/demo/content";
import { countWords } from "@/lib/generation/word-count";
import { contentFromDraft, validateGeneratedDraft, type GeneratedDraft } from "@/lib/generation/schemas";

const unmatchedAnswers: Answers = { ...demoAnswers, competences: "aucune", temps_jour: "moins_1h", zone: "anglophone" };

function generationFixture() {
  const profile = buildProfile(demoAnswers);
  const candidates = matchIdeas(profile);
  const content = generateDemoContent(demoAnswers);
  const draft: GeneratedDraft = {
    selections: content.selections.map(({ id, idea_snapshot, canal_acquisition, ...selection }) => ({ ...selection, canal_id: allowedChannels(idea_snapshot)[0].id })),
    build_prompt: content.build_prompt,
    tasks: content.tasks.map(({ id, done, ...task }) => ({ ...task, canal_id: "none" })),
  };
  return { profile, candidates, draft };
}

describe("Questionnaire et banque éditoriale", () => {
  it("pose neuf questions, termine par le curseur de revenu et renseigne vingt idées", () => {
    expect(questions).toHaveLength(9);
    expect(new Set(questions.map((question) => question.id)).size).toBe(9);
    expect(questions[0].id).toBe("tranche_age");
    expect(questions.at(-1)?.type).toBe("range");
    const domains = questions.find((question) => question.id === "domaines")!.options.map((option) => option.value);
    expect(ideas).toHaveLength(20); expect(new Set(ideas.map((idea) => idea.id)).size).toBe(20);
    for (const idea of ideas) {
      expect(idea.pitch.length).toBeGreaterThan(30); expect(idea.probleme.length).toBeGreaterThan(70);
      expect(ideaRules[idea.id]).toBeDefined(); expect(allowedChannels(idea).length).toBeGreaterThan(0);
      for (const domain of ideaRules[idea.id].domains) expect(domains).toContain(domain);
    }
  });
  it("rejette les réponses incomplètes, inconnues ou hors des options", () => {
    expect(() => validateAnswers({})).toThrow();
    expect(() => validateAnswers({ ...demoAnswers, question_inventee: "x" })).toThrow();
    expect(validateAnswer("competences", "expert_millionnaire")).toBe(false);
    expect(validateAnswer("domaines", [])).toBe(false);
    expect(validateAnswer("domaines", ["vente", "vente"])).toBe(false);
    expect(validateAnswer("domaines", ["vente", "marketing", "finance", "sante"])).toBe(false);
    expect(validateAnswer("objectif_revenu", "2500")).toBe(false);
    expect(validateAnswer("objectif_revenu", "50000")).toBe(true);
    expect(validateAnswers(demoAnswers)).toEqual(demoAnswers);
    expect(isComplete(demoAnswers)).toBe(true);
    expect(isComplete({ ...demoAnswers, objectif_revenu: "" })).toBe(false);
  });
});

describe("Sélection des idées", () => {
  it("ne garde que des idées compatibles quand il y en a assez", () => {
    const profile = buildProfile(demoAnswers);
    const candidates = matchIdeas(profile);
    expect(candidates.length).toBeGreaterThanOrEqual(3); expect(candidates.length).toBeLessThanOrEqual(8);
    for (const idea of candidates) expect(rejectionReasons(idea, profile)).toEqual([]);
  });
  it("propose quand même trois idées quand aucune ne respecte les limites", () => {
    const profile = buildProfile(unmatchedAnswers);
    expect(ideas.every((idea) => rejectionReasons(idea, profile).length > 0)).toBe(true);
    const candidates = matchIdeas(profile);
    expect(candidates).toHaveLength(3);
    expect(new Set(candidates.map((idea) => idea.id)).size).toBe(3);
  });
  it("place les idées compatibles avant les plus proches", () => {
    const profile = buildProfile({ ...demoAnswers, competences: "aucune", temps_jour: "moins_1h" });
    const fitting = ideas.filter((idea) => rejectionReasons(idea, profile).length === 0).map((idea) => idea.id).sort();
    expect(fitting.length).toBeGreaterThan(0); expect(fitting.length).toBeLessThan(3);
    const candidates = matchIdeas(profile);
    expect(candidates).toHaveLength(3);
    expect(candidates.slice(0, fitting.length).map((idea) => idea.id).sort()).toEqual(fitting);
  });
  it("fait remonter les domaines choisis", () => {
    const profile = buildProfile({ ...demoAnswers, domaines: ["sport"], competences: "application", temps_jour: "journee" });
    expect(ideaRules[matchIdeas(profile)[0].id].domains).toContain("sport");
  });
});

describe("Dossier et contrat de génération", () => {
  it.each([["le profil de démonstration", demoAnswers], ["un profil sans idée compatible", unmatchedAnswers]])("livre trois idées, un prompt de 700 à 900 mots et six tâches par semaine pour %s", (_label, answers) => {
    const content = generateDemoContent(answers);
    expect(content.selections).toHaveLength(3); expect(content.tasks).toHaveLength(24);
    expect(countWords(content.build_prompt)).toBeGreaterThanOrEqual(700);
    expect(countWords(content.build_prompt)).toBeLessThanOrEqual(900);
    for (let week = 1; week <= 4; week++) expect(content.tasks.filter((task) => task.semaine === week)).toHaveLength(6);
    expect(new Set(content.selections.flatMap((selection) => selection.reponses_citees.map((citation) => citation.question_id))).size).toBe(questions.length);
  });
  it.each([
    { competences: "application", zone: "francophone", tranche_age: "25_34", cible_client: "b2b", facturation: "abonnement" },
    { competences: "interface", zone: "europe", tranche_age: "moins_18", cible_client: "b2c", facturation: "usage" },
    { competences: "sans_code", zone: "mondial", tranche_age: "55_plus", cible_client: "decide", facturation: "licence" },
    { competences: "aucune", zone: "anglophone", tranche_age: "moins_18", cible_client: "b2c", facturation: "indifferent" },
  ])("maintient le prompt entre 700 et 900 mots ($competences, $zone, $tranche_age)", (variant) => {
    const words = countWords(generateDemoContent({ ...demoAnswers, ...variant }).build_prompt);
    expect(words).toBeGreaterThanOrEqual(700); expect(words).toBeLessThanOrEqual(900);
  });
  it("rejette les idées inventées, les faux verbatims, les réponses oubliées et les prompts trop courts", () => {
    const { profile, candidates, draft } = generationFixture();
    expect(() => validateGeneratedDraft(draft, candidates, profile)).not.toThrow();
    expect(() => validateGeneratedDraft({ ...draft, build_prompt: "Trop court." }, candidates, profile)).toThrow();
    const invented = structuredClone(draft); invented.selections[0].idea_id = "idee-inventee";
    expect(() => validateGeneratedDraft(invented, candidates, profile)).toThrow();
    const falseCitation = structuredClone(draft); falseCitation.selections[0].reponses_citees[0].reponse = "Je vise un million d’euros par mois.";
    expect(() => validateGeneratedDraft(falseCitation, candidates, profile)).toThrow();
    const forgotten = structuredClone(draft);
    const citation = forgotten.selections.flatMap((selection) => selection.reponses_citees).find((entry) => entry.question_id === "objectif_revenu")!;
    const owner = forgotten.selections.find((selection) => selection.reponses_citees.includes(citation))!;
    const replacement = profile.evidence.find((entry) => !owner.reponses_citees.some((cited) => cited.question_id === entry.question_id))!;
    Object.assign(citation, { question_id: replacement.question_id, reponse: replacement.reponse });
    expect(() => validateGeneratedDraft(forgotten, candidates, profile)).toThrow(/réponses doivent avoir un effet/);
  });
  it("construit le canal affiché depuis le choix autorisé et refuse un canal libre", () => {
    const { profile, candidates, draft } = generationFixture();
    const selected = draft.selections.find((selection) => allowedChannels(candidates.find((idea) => idea.id === selection.idea_id)!).length > 1)!;
    const idea = candidates.find((candidate) => candidate.id === selected.idea_id)!;
    selected.canal_id = allowedChannels(idea)[1].id;
    const content = contentFromDraft(validateGeneratedDraft(draft, candidates, profile), candidates);
    expect(content.selections.find((selection) => selection.idea_id === idea.id)!.canal_acquisition).toBe(acquisitionFor(idea, selected.canal_id));
    expect(acquisitionFor(idea, selected.canal_id)).not.toBe(acquisitionFor(idea));
    expect(() => acquisitionFor(idea, "face")).toThrow();
    const wrongChannel = structuredClone(draft); wrongChannel.tasks[0].canal_id = "face";
    expect(() => validateGeneratedDraft(wrongChannel, candidates, profile)).toThrow(/canal incompatible/);
    const injected = structuredClone(draft);
    Object.assign(injected.selections[0], { canal_acquisition: "Envoyez dix messages à froid aux commerçants de votre ville." });
    expect(() => validateGeneratedDraft(injected, candidates, profile)).toThrow();
  });
});
