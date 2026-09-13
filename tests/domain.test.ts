import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Answers } from "@/types/domain";
import { questions } from "@/lib/questionnaire/questions";
import { isComplete, validateAnswer, validateAnswers } from "@/lib/questionnaire/schemas";
import { buildProfile } from "@/lib/questionnaire/profile";
import { ideas, rejectionReasons } from "@/lib/matching/filters";
import { matchIdeas } from "@/lib/matching/scoring";
import { acquisitionFor, allowedChannels, ideaRules } from "@/lib/matching/idea-rules";
import { buildDossierContent, buildExtras, demoAnswers, type IdeaContent } from "@/lib/dossier/content";
import { countWords } from "@/lib/dossier/word-count";
import { formatCents, monthlyEquivalent, perDay, plans, savingsPercent } from "@/config/pricing";

const lookup = (id: string) => JSON.parse(readFileSync(`data/contenus/${id}.json`, "utf8")) as IdeaContent;
const unmatchedAnswers: Answers = { ...demoAnswers, competences: "aucune", temps_jour: "moins_1h", zone: "anglophone" };

describe("Formules d’abonnement", () => {
  it("calcule les prix par jour et les économies à partir du prix mensuel réel", () => {
    const text = (value: string) => value.replace(/\s/g, " ");
    expect(plans.map((plan) => [plan.id, plan.cents, plan.periodDays, plan.videoIdeas, plan.roadmap])).toEqual([["mensuel", 1899, 30, 0, false], ["trimestriel", 2999, 90, 30, false], ["annuel", 6999, 365, 60, true]]);
    expect(plans.map((plan) => text(perDay(plan)))).toEqual(["0,63 €", "0,33 €", "0,19 €"]);
    expect(plans.map(savingsPercent)).toEqual([0, 47, 69]);
    expect(plans.slice(1).map((plan) => text(formatCents(monthlyEquivalent(plan))))).toEqual(["56,97 €", "227,88 €"]);
  });
});

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

describe("Dossier assemblé à partir des contenus rédigés", () => {
  it.each([["le profil de démonstration", demoAnswers], ["un profil sans idée compatible", unmatchedAnswers]])("livre trois idées, un prompt de 700 à 900 mots et six tâches par semaine pour %s", (_label, answers) => {
    const content = buildDossierContent(answers, lookup);
    expect(content.selections).toHaveLength(3); expect(content.tasks).toHaveLength(24);
    expect(new Set(content.tasks.map((task) => task.id)).size).toBe(24);
    expect(countWords(content.build_prompt)).toBeGreaterThanOrEqual(700);
    expect(countWords(content.build_prompt)).toBeLessThanOrEqual(900);
    for (let week = 1; week <= 4; week++) expect(content.tasks.filter((task) => task.semaine === week)).toHaveLength(6);
    expect(new Set(content.selections.flatMap((selection) => selection.reponses_citees.map((citation) => citation.question_id))).size).toBe(questions.length);
    for (const selection of content.selections) expect(selection.risque).toContain(lookup(selection.idea_id).risque);
  });
  it("adapte le prompt aux compétences, à la zone et au périmètre de l’idée", () => {
    const content = buildDossierContent(demoAnswers, lookup);
    const idea = content.selections[0].idea_snapshot;
    expect(content.build_prompt).toContain("no-code");
    expect(content.build_prompt).toContain(lookup(idea.id).prompt.ecrans[0]);
    const english = buildDossierContent({ ...demoAnswers, zone: "anglophone", competences: "application" }, lookup).build_prompt;
    expect(english).toContain("Next.js"); expect(english).toContain("en anglais");
  });
  it("donne à chaque formule ses bonus, avec l’objectif de revenu dans le plan de A à Z", () => {
    const ideaId = buildDossierContent(demoAnswers, lookup).selections[0].idea_id;
    expect(buildExtras(demoAnswers, ideaId, { videos: 0, roadmap: false }, lookup)).toEqual({});
    expect(buildExtras(demoAnswers, ideaId, { videos: 30, roadmap: false }, lookup).videos).toEqual(lookup(ideaId).videos.slice(0, 30));
    const annual = buildExtras(demoAnswers, ideaId, { videos: 60, roadmap: true }, lookup);
    expect(annual.videos).toHaveLength(60); expect(annual.roadmap).toHaveLength(7);
    const roadmap = JSON.stringify(annual.roadmap);
    expect(roadmap).not.toMatch(/\{[a-z_]+\}/);
    expect(roadmap.replace(/\s/g, " ")).toContain("2 000 € par mois");
    expect(() => buildExtras(demoAnswers, "idee-inventee", { videos: 30, roadmap: false }, lookup)).toThrow();
  });
  it("construit le canal affiché depuis les canaux autorisés de l’idée", () => {
    const idea = ideas.find((entry) => allowedChannels(entry).length > 1 && !allowedChannels(entry).some((channel) => channel.id === "face"))!;
    expect(acquisitionFor(idea, allowedChannels(idea)[1].id)).not.toBe(acquisitionFor(idea));
    expect(() => acquisitionFor(idea, "face")).toThrow();
  });
});
