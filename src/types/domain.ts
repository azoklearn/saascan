export type AnswerValue = string | number | string[];
export type Answers = Record<string, AnswerValue>;

export type Question = {
  id: string;
  label: string;
  description: string;
  block: 1 | 2 | 3 | 4 | 5;
  type: "single" | "multiple" | "scale" | "text";
  options?: { value: string; label: string; detail?: string }[];
  placeholder?: string;
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
  dossier_id?: string;
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

export type DossierSummary = {
  id: string;
  statut: "brouillon" | "generation" | "pret" | "echec";
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  response_count: number;
};

export type DossierRecord = {
  dossier: DossierSummary;
  answers: Answers;
  content?: DossierContent;
};
