import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Answers } from "@/types/domain";
import { questions } from "@/lib/questionnaire/questions";
import { isComplete, upgradeLegacyAnswers, validateAnswer, validateAnswers } from "@/lib/questionnaire/schemas";
import { buildProfile } from "@/lib/questionnaire/profile";
import { ideas, rejectionReasons } from "@/lib/matching/filters";
import { matchIdeas } from "@/lib/matching/scoring";
import { acquisitionFor, allowedChannels, ideaRules } from "@/lib/matching/idea-rules";
import { buildDossierContent, buildExtras, demoAnswers, type IdeaContent } from "@/lib/dossier/content";
import { countWords } from "@/lib/dossier/word-count";
import { formatCents, monthlyEquivalent, perDay, plans, savingsPercent } from "@/config/pricing";

const lookup = (id: string) => JSON.parse(readFileSync(`data/contenus/${id}.json`, "utf8")) as IdeaContent;
const unmatchedAnswers: Answers = { ...demoAnswers, temps_jour: "moins_1h", delai_premier_euro: "deux_semaines" };
const legacyAnswers = { tranche_age: "25_34", cible_client: "b2b", domaines: ["vente"], competences: "sans_code", temps_jour: "1h", zone: "francophone", facturation: "abonnement", concurrence: "differencier", objectif_revenu: "2000" };
const faceVideos = (channel: string) => channel.startsWith("Publiez trois courtes vidéos face caméra");

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
  it("pose cinq questions en commençant par le curseur de revenu et renseigne vingt idées", () => {
    expect(questions.map((question) => question.id)).toEqual(["objectif_revenu", "tranche_age", "delai_premier_euro", "temps_jour", "niveau_video"]);
    expect(questions[0].type).toBe("range");
    expect(ideas).toHaveLength(20); expect(new Set(ideas.map((idea) => idea.id)).size).toBe(20);
    for (const idea of ideas) {
      expect(idea.pitch.length).toBeGreaterThan(30); expect(idea.probleme.length).toBeGreaterThan(70);
      expect(ideaRules[idea.id]).toBeDefined();
      // Chaque idée garde un canal sans vidéo face caméra pour qui préfère éviter le contenu.
      expect(allowedChannels(idea).some((channel) => channel.id !== "face")).toBe(true);
    }
  });
  it("rejette les réponses incomplètes, inconnues ou hors des options", () => {
    expect(() => validateAnswers({})).toThrow();
    expect(() => validateAnswers({ ...demoAnswers, question_inventee: "x" })).toThrow();
    expect(() => validateAnswers({ ...demoAnswers, domaines: ["vente"] })).toThrow();
    expect(validateAnswer("niveau_video", "expert")).toBe(false);
    expect(validateAnswer("delai_premier_euro", "hier")).toBe(false);
    expect(validateAnswer("objectif_revenu", "2500")).toBe(false);
    expect(validateAnswer("objectif_revenu", "50000")).toBe(true);
    expect(validateAnswers(demoAnswers)).toEqual(demoAnswers);
    expect(isComplete(demoAnswers)).toBe(true);
    expect(isComplete({ ...demoAnswers, objectif_revenu: "" })).toBe(false);
  });
  it("reprend les réponses d’un dossier payé avec l’ancien questionnaire", () => {
    const upgraded = validateAnswers(upgradeLegacyAnswers(legacyAnswers));
    expect(isComplete(upgraded)).toBe(true);
    expect(upgraded).toMatchObject({ objectif_revenu: "2000", tranche_age: "25_34", temps_jour: "1h" });
    expect(upgradeLegacyAnswers(demoAnswers)).toBe(demoAnswers);
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
    const profile = buildProfile({ ...demoAnswers, temps_jour: "moins_1h" });
    const fitting = ideas.filter((idea) => rejectionReasons(idea, profile).length === 0).map((idea) => idea.id).sort();
    expect(fitting.length).toBeGreaterThan(0); expect(fitting.length).toBeLessThan(3);
    const candidates = matchIdeas(profile);
    expect(candidates).toHaveLength(3);
    expect(candidates.slice(0, fitting.length).map((idea) => idea.id).sort()).toEqual(fitting);
  });
  it("écarte les clients longs à convaincre pour une vente sous deux semaines", () => {
    const profile = buildProfile({ ...demoAnswers, delai_premier_euro: "deux_semaines", temps_jour: "journee" });
    const fitting = ideas.filter((idea) => rejectionReasons(idea, profile).length === 0);
    expect(fitting.length).toBeGreaterThan(0);
    for (const idea of fitting) expect(idea.difficulte_distribution).toBeLessThan(3);
  });
  it("réserve les vidéos face caméra à qui s’y sent à l’aise", () => {
    expect(allowedChannels(matchIdeas(buildProfile(demoAnswers))[0]).some((channel) => channel.id === "face")).toBe(true);
    for (const niveau_video of ["sans_visage", "a_apprendre", "non"]) {
      const content = buildDossierContent({ ...demoAnswers, niveau_video }, lookup);
      for (const selection of content.selections) expect(faceVideos(selection.canal_acquisition)).toBe(false);
      expect(content.build_prompt).not.toContain("Publiez trois courtes vidéos face caméra");
    }
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
    for (const selection of content.selections) {
      expect(selection.risque).toContain(lookup(selection.idea_id).risque);
      for (const citation of selection.reponses_citees) expect(citation.effet).toBeTruthy();
    }
  });
  it("adapte le prompt à l’idée, au délai de la première vente et à un outil guidé", () => {
    const content = buildDossierContent(demoAnswers, lookup);
    const idea = content.selections[0].idea_snapshot;
    expect(content.build_prompt).toContain("Lovable");
    expect(content.build_prompt).toContain(lookup(idea.id).prompt.ecrans[0]);
    expect(content.build_prompt).toContain("d’ici un mois");
    expect(buildDossierContent({ ...demoAnswers, delai_premier_euro: "trois_mois" }, lookup).build_prompt).toContain("d’ici trois mois");
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
