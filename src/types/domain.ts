export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

export type QuestionOption = { value: string; label: string; detail?: string; short?: string };

export type Question = {
  id: string;
  label: string;
  description?: string;
  type: "single" | "multiple" | "range";
  options: QuestionOption[];
  maxChoices?: number;
  defaultValue?: string;
};

export type Idea = {
  id: string;
  nom: string;
  pitch: string;
  probleme: string;
  cible: string;
  modele_eco: string;
  prix_conseille: string;
  difficulte_technique: number;
  difficulte_distribution: number;
  temps_mvp_jours: number;
  budget_min_euros: number;
  tags: string[];
  premiers_clients: string;
  pourquoi_maintenant: string;
};

export type Selection = {
  id: string;
  idea_id: string;
  idea_snapshot: Idea;
  rang: number;
  justification: string;
  adaptation: string;
  canal_acquisition: string;
  risque: string;
  reponses_citees: { question_id: string; reponse: string; effet: string }[];
};

export type PlanTask = {
  id: string;
  semaine: number;
  position: number;
  libelle: string;
  done: boolean;
};

export type DossierContent = {
  selections: Selection[];
  build_prompt: string;
  tasks: PlanTask[];
};

export type DossierState = {
  statut: "brouillon" | "generation" | "pret" | "echec";
  paid_at: string | null;
  refunded_at: string | null;
  generation_attempts: number;
  generation_started_at: string | null;
};

export type DossierRecord = {
  dossier: DossierState;
  content?: DossierContent;
};
