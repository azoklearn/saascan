import { describe, expect, it } from "vitest";
import { questions } from "@/lib/questionnaire/questions";
import { validateAnswers, validateAnswer } from "@/lib/questionnaire/schemas";
import { buildProfile } from "@/lib/questionnaire/profile";
import { ideas, filterIdeas } from "@/lib/matching/filters";
import { matchIdeas } from "@/lib/matching/scoring";
import { acquisitionFor, allowedChannels, ideaRules } from "@/lib/matching/idea-rules";
import { demoAnswers, generateDemoContent } from "@/lib/demo/content";
import { countWords } from "@/lib/generation/word-count";
import { contentFromDraft, validateGeneratedDraft, type GeneratedDraft } from "@/lib/generation/schemas";

function generationFixture() {
  const profile = buildProfile(demoAnswers);
  const candidates = matchIdeas(profile);
  const content = generateDemoContent(demoAnswers);
  const draft: GeneratedDraft = {
    selections: content.selections.map(({ id, idea_snapshot, canal_acquisition, ...selection }) => ({ ...selection, canal_id: allowedChannels(idea_snapshot, profile)[0].id })),
    build_prompt: content.build_prompt,
    tasks: content.tasks.map(({ id, done, dossier_id, ...task }) => ({ ...task, canal_id: "none" })),
  };
  return { profile, candidates, draft };
}

describe("Questionnaire et banque éditoriale", () => {
  it("possède exactement 20 questions distinctes et 20 idées renseignées", () => {
    expect(questions).toHaveLength(20); expect(new Set(questions.map(q => q.id)).size).toBe(20);
    expect(ideas).toHaveLength(20); expect(new Set(ideas.map(i => i.id)).size).toBe(20);
    for (const idea of ideas) {
      expect(idea.pitch.length).toBeGreaterThan(30); expect(idea.probleme.length).toBeGreaterThan(70);
      expect(idea.premiers_clients.length).toBeGreaterThan(35); expect(ideaRules[idea.id]).toBeDefined();
      expect(idea.temps_mvp_jours).toBeLessThan(30);
    }
  });
  it("rejette les profils incomplets et les options injectées", () => {
    expect(() => validateAnswers({})).toThrow(); expect(() => validateAnswers({ ...demoAnswers, alien: true })).toThrow();
    expect(validateAnswer("niveau_code", "expert_millionnaire")).toBe(false);
    expect(validateAnswer("aisance_ia", 6)).toBe(false); expect(validateAnswer("secteur", "x".repeat(401))).toBe(false);
    expect(validateAnswer("types_produits", ["b2b", "b2b"])).toBe(false);
    expect(validateAnswers(demoAnswers)).toEqual(demoAnswers);
  });
});

describe("Contraintes déterministes", () => {
  it("respecte le budget zéro, le niveau débutant et les heures de la semaine de construction", () => {
    const profile = buildProfile({ ...demoAnswers, budget_depart: "0", temps_semaine: "5" });
    const candidates = matchIdeas(profile);
    expect(candidates.length).toBeGreaterThanOrEqual(3); expect(candidates.length).toBeLessThanOrEqual(8);
    for (const idea of candidates) {
      expect(idea.budget_min_euros).toBe(0); expect(idea.difficulte_technique).toBeLessThanOrEqual(profile.maxTechnicalDifficulty);
      expect(ideaRules[idea.id].effort_mvp_heures).toBeLessThanOrEqual(5);
      expect(allowedChannels(idea, profile).every(channel => !["cold", "face"].includes(channel.id))).toBe(true);
    }
  });
  it("refuse trois idées si la capacité déclarée ne permet pas de les construire", () => {
    expect(() => matchIdeas(buildProfile({ ...demoAnswers, temps_semaine: "3" }))).toThrow();
  });
});

describe("Dossier et contrat de génération", () => {
  it("livre trois idées, un vrai prompt 700–900 mots et six tâches par semaine", () => {
    const content = generateDemoContent(demoAnswers);
    expect(content.selections).toHaveLength(3); expect(content.tasks).toHaveLength(24);
    expect(countWords(content.build_prompt)).toBeGreaterThanOrEqual(700);
    expect(countWords(content.build_prompt)).toBeLessThanOrEqual(900);
    for (let week = 1; week <= 4; week++) expect(content.tasks.filter(t => t.semaine === week)).toHaveLength(6);
    expect(new Set(content.selections.flatMap(s => s.reponses_citees.map(c => c.question_id))).size).toBe(20);
  });
  it.each(["aucun", "lecture", "debutant", "confirme"])("maintient le prompt borné pour le niveau %s", niveau_code => {
    const content = generateDemoContent({ ...demoAnswers, niveau_code });
    expect(countWords(content.build_prompt)).toBeGreaterThanOrEqual(700);
    expect(countWords(content.build_prompt)).toBeLessThanOrEqual(900);
  });
  it("rejette les idées inventées, les faux verbatims et les prompts trop courts", () => {
    const { profile, candidates, draft } = generationFixture();
    expect(() => validateGeneratedDraft(draft, candidates, profile)).not.toThrow();
    expect(() => validateGeneratedDraft({ ...draft, build_prompt: "Trop court." }, candidates, profile)).toThrow();
    const invented = structuredClone(draft); invented.selections[0].idea_id = "idee-inventee";
    expect(() => validateGeneratedDraft(invented, candidates, profile)).toThrow();
    const falseCitation = structuredClone(draft); falseCitation.selections[0].reponses_citees[0].reponse = "Je dispose de 100 000 euros.";
    expect(() => validateGeneratedDraft(falseCitation, candidates, profile)).toThrow();
  });
  it("construit le canal affiché depuis le choix autorisé et refuse un canal libre injecté", () => {
    const { profile, candidates, draft } = generationFixture();
    const selected = draft.selections.find((selection) => allowedChannels(candidates.find((idea) => idea.id === selection.idea_id)!, profile).length > 1)!;
    const idea = candidates.find((candidate) => candidate.id === selected.idea_id)!;
    selected.canal_id = allowedChannels(idea, profile)[1].id;
    const checked = validateGeneratedDraft(draft, candidates, profile);
    const content = contentFromDraft(checked, candidates, profile);
    expect(content.selections.find((selection) => selection.idea_id === selected.idea_id)!.canal_acquisition).toBe(acquisitionFor(idea, profile, selected.canal_id));
    expect(acquisitionFor(idea, profile, selected.canal_id)).not.toBe(acquisitionFor(idea, profile));
    expect(() => acquisitionFor(idea, profile, "cold")).toThrow();
    const injected = structuredClone(draft);
    Object.assign(injected.selections[0], { canal_acquisition: "Envoie dix messages à froid aux commerçants de ta ville." });
    expect(() => validateGeneratedDraft(injected, candidates, profile)).toThrow();
  });
  it.each([
    "Envoie dix emails à froid aux artisans de ta ville.",
    "Publie une vidéo face caméra pour vendre ton outil.",
    "Contacte par message dix inconnus sur LinkedIn.",
    "Ne parle pas de ton budget, puis filme ton visage pour présenter le produit.",
  ])("rejette une tâche incompatible même marquée none : %s", (libelle) => {
    const { profile, candidates, draft } = generationFixture();
    draft.tasks[0].libelle = libelle;
    expect(() => validateGeneratedDraft(draft, candidates, profile)).toThrow(/malgré ton refus/);
  });
  it("contrôle aussi les descriptions et le prompt sans rejeter les interdictions explicites", () => {
    const { profile, candidates, draft } = generationFixture();
    const adaptation = structuredClone(draft);
    adaptation.selections[0].adaptation += " Commence une campagne de cold emails pour recruter tes premiers clients.";
    expect(() => validateGeneratedDraft(adaptation, candidates, profile)).toThrow(/malgré ton refus/);
    const prompt = structuredClone(draft);
    prompt.build_prompt += " Publie un selfie chaque jour pour vendre le produit.";
    expect(() => validateGeneratedDraft(prompt, candidates, profile)).toThrow(/malgré ton refus/);
    draft.tasks[0].libelle = "Ne montre pas ton visage et ne fais aucun démarchage à froid ; utilise une capture d’écran.";
    expect(() => validateGeneratedDraft(draft, candidates, profile)).not.toThrow();
  });
});
