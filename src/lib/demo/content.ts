import type { Answers, DossierContent, Idea, PlanTask, Selection } from "@/types/domain";
import { buildProfile, type UserProfile } from "@/lib/questionnaire/profile";
import { answerLabel } from "@/lib/questionnaire/questions";
import { acquisitionFor, ideaRules } from "@/lib/matching/idea-rules";
import { matchIdeas } from "@/lib/matching/scoring";
import { countWords } from "@/lib/generation/word-count";

/** An explicit, offline example profile. Production generation never calls this. */
export const demoAnswers: Answers = {
  temps_semaine: "10", budget_depart: "50", revenus_en_ligne: "jamais", delai_premier_euro: "30",
  niveau_code: "aucun", aisance_ia: 3, niveau_design: 2, niveau_vente: 2, niveau_video: 1,
  secteur: "Je travaille dans une entreprise de rénovation avec des artisans.",
  communautes: "Le groupe des artisans indépendants de ma ville.",
  audience: "Aucune", reseau_pro: "6_20", langues: ["francais"],
  montrer_visage: "non", demarchage_froid: "non", risque: "faible",
  types_produits: ["b2b", "automatisation"], taches_detestees: ["video"], ambition: "complement",
};

const excerpt = (value: string, words = 8) => value.replace(/[\r\n#<>`]/g, " ").trim().split(/\s+/).slice(0, words).join(" ");

function effectsFor(profile: UserProfile, idea: Idea): Record<string, string> {
  const rule = ideaRules[idea.id];
  return {
    temps_semaine: `Le MVP est limité à ${rule.effort_mvp_heures} heures dans une semaine de ${profile.weeklyHours} heures ; les autres semaines restent disponibles pour valider et vendre.`,
    budget_depart: `Le socle exige ${idea.budget_min_euros} € au départ, sous ton plafond de ${profile.budgetEuros} € ; aucun achat de trafic n’est prévu.`,
    revenus_en_ligne: profile.incomeExperience === "jamais" ? "La première validation porte sur une seule offre et une demande de paiement explicite pour apprendre sans multiplier les produits." : "Ton expérience permet de tester une offre avec un entretien centré sur le prix et les objections, plutôt que de découvrir seulement le principe de vente.",
    delai_premier_euro: `Ton échéance de ${profile.firstEuroDays} jours détermine le rythme : ${profile.firstEuroDays === 30 ? "proposer une première offre dès le mois 1" : "tester l’intérêt au mois 1 puis confirmer une date de livraison avant de faire payer"}, sans garantie de vente.`,
    niveau_code: profile.codeLevel === "aucun" ? "Le prompt impose un montage visuel guidé, un modèle prêt à adapter et une vérification à chaque étape." : "Le prompt propose une stack guidée ou un petit projet web selon ton autonomie ; aucun système technique au-delà de ton niveau.",
    aisance_ia: `Avec une aisance IA de ${profile.aiSkill}/5, ${profile.aiSkill <= 2 ? "chaque demande est découpée en une action et suivie d’un contrôle visuel" : "l’IA aide à produire les textes et à examiner les erreurs, avec validation humaine"}.`,
    niveau_design: `Avec ${profile.designSkill}/5 en design, ${profile.designSkill <= 2 ? "un modèle unique et des composants standards évitent de créer une identité graphique entière" : "tu peux ajuster la hiérarchie visuelle après validation du parcours principal"}.`,
    niveau_vente: `Avec ${profile.salesSkill}/5 en vente, ${profile.salesSkill <= 2 ? "les entretiens suivent quatre questions simples puis une proposition de pilote" : "tu peux approfondir le coût du problème et tester directement deux formulations de l’offre"}.`,
    niveau_video: `Avec ${profile.videoSkill}/5 en vidéo, ${profile.videoSkill <= 2 || profile.dislikes.includes("video") ? "les démonstrations reposent sur des captures annotées et du texte" : "un enregistrement d’écran court peut expliquer le parcours"}.`,
    secteur: `Ton expérience « ${excerpt(profile.sector)} » sert à choisir le vocabulaire des exemples ; la proximité avec cette cible doit être confirmée en entretien.`,
    communautes: `Ta communauté déclarée « ${excerpt(profile.communities)} » est un point de départ à vérifier ; sans accès adapté, il faut d’abord rejoindre un espace métier et obtenir l’accord de publier.`,
    audience: `L’audience déclarée « ${excerpt(profile.audience)} » sert uniquement si elle comprend cette cible ; aucune taille ni portée supplémentaire n’est supposée.`,
    reseau_pro: profile.network === "0" ? "Aucun contact connu n’est supposé : la validation commence par une ressource autorisée et des appels à volontaires." : "Les premiers entretiens peuvent passer par tes contacts connus, en leur demandant si le problème les concerne réellement.",
    langues: `Le lancement sert d’abord les clients en français ; ${profile.languages.length > 1 ? "tes autres langues permettront un second test après validation du premier segment" : "la traduction est exclue du premier mois"}.`,
    montrer_visage: profile.acceptsFace ? "Ton accord autorise une présentation publique, seulement si le canal de cette idée le justifie." : "Le canal et le plan n’exigent jamais de vidéo publique de ton visage.",
    demarchage_froid: profile.acceptsCold ? "Les prises de contact individuelles ne sont possibles que lorsqu’elles font partie d’un canal autorisé de l’idée." : "Les échanges commencent par des contacts connus ou des volontaires ; aucune campagne de messages à froid.",
    risque: profile.risk === "faible" ? "Dix conversations précèdent la construction et une absence de problème répété déclenche un arrêt ou une réduction du périmètre." : "Une hypothèse de niche peut être explorée avec un test limité ; la décision de continuer dépend des retours, pas du temps déjà investi.",
    types_produits: `La préférence « ${answerLabel("types_produits", profile.preferredTypes)} » pèse dans le classement ; un intérêt marketplace reste limité à un outil pour un seul côté déjà existant.`,
    taches_detestees: profile.dislikes.includes("aucune") ? "Aucun repoussoir n’est déclaré : le plan garde les tâches nécessaires, sans ajouter de spécialisation artificielle." : `Les tâches « ${answerLabel("taches_detestees", profile.dislikes)} » réduisent le score des idées qui en dépendent ; le périmètre et les modèles limitent ces efforts sans prétendre les supprimer.`,
    ambition: profile.ambition === "complement" ? "L’offre reste petite avec un entretien limité, une seule cible et un rythme compatible avec une autre activité." : "Le test privilégie une offre récurrente et un suivi des usages pour vérifier si une activité plus importante pourrait être viable.",
  };
}

export function buildDemoPrompt(idea: Idea, profile: UserProfile): string {
  const rule = ideaRules[idea.id];
  const stack = profile.codeLevel === "aucun"
    ? "Utilise un constructeur visuel no-code avec une base simple, des formulaires et un espace réservé au propriétaire. Guide chaque clic et explique les vérifications. Commence par une instance séparée par client et des modèles duplicables. Ne demande aucune commande terminal. Vérifie les limites des offres avant de choisir les outils."
    : profile.codeLevel === "lecture"
      ? "Utilise une stack guidée avec un constructeur visuel et Supabase pour la base. Fournis les petites modifications une par une, explique où les appliquer et donne une vérification après chacune. Évite les intégrations externes. Commence par une instance séparée par client et une authentification gérée par le fournisseur."
      : "Utilise Next.js, TypeScript, Supabase pour les comptes et la base, puis Vercel pour publier. Garde une structure courte avec validation serveur, accès par propriétaire et composants réutilisables. Explique les variables nécessaires et fournis une migration reproductible. Aucune infrastructure personnalisée, aucun traitement asynchrone complexe et aucune intégration non indispensable."
  ;
  const prompt = `# Construire ${idea.nom}

## Contexte et résultat attendu
Construis un premier outil nommé ${idea.nom}. Sa promesse : ${idea.pitch} La cible initiale est précise : ${idea.cible} Il faut résoudre un seul problème récurrent avant d’ajouter des fonctions. N’invente aucune preuve commerciale. Le périmètre autorisé est ${rule.scope}.

## Contraintes de la personne qui construit
La construction dispose de ${profile.weeklyHours} heures pendant la deuxième semaine et d’un budget initial maximal de ${profile.budgetEuros} euros. L’effort estimé du périmètre est de ${rule.effort_mvp_heures} heures. Réserve les autres semaines à la validation, aux essais et à la vente. Mon terrain est « ${excerpt(profile.sector)} ». Mon ambition est ${profile.ambition === "complement" ? "un complément de revenu avec peu de maintenance" : "une activité principale à valider progressivement"}. L’échéance de première offre est de ${profile.firstEuroDays} jours. Signale tout dépassement.

## Stack et accompagnement
${stack} ${profile.aiSkill <= 2 ? "Découpe chaque demande à l’assistant en une seule action. Vérifie le résultat à l’écran avant de continuer." : "Utilise l’assistant pour préparer les textes et examiner les erreurs, puis vérifie toi-même chaque résultat avant la suite."} ${profile.designSkill <= 2 ? "Pars d’un modèle sobre existant, conserve ses composants et limite les choix visuels à une couleur." : "Crée une hiérarchie visuelle nette, puis ajuste uniquement les éléments utiles à la compréhension du parcours principal."}

## Parcours, écran par écran
Écran un : une page publique décrit le problème, montre un exemple fictif clairement identifié et propose un essai. Elle expose le prix, les limites et un moyen de contact. Écran deux : l’utilisateur se connecte avec la méthode du fournisseur choisi ; une erreur doit être compréhensible et permettre de recommencer. Écran trois : un accueil vide explique la première action avec un exemple supprimable. Écran quatre : un formulaire recueille seulement les informations indispensables au périmètre. Les champs obligatoires et les erreurs sont visibles. Écran cinq : une vue de détail permet de consulter, modifier et supprimer une entrée avec confirmation. Écran six : une page d’aide explique les limites, le paiement et la récupération des données. 

## Modèle de données et accès
Prévois un propriétaire avec identifiant et email, un espace de travail lié au propriétaire et des entrées métier liées à cet espace. Chaque entrée possède un identifiant, un titre, les champs nécessaires, un état, une date de création et une date de modification. Ajoute une préférence de langue et un état d’accès payant géré par le propriétaire du service. Utilise les permissions natives du fournisseur ou des règles par propriétaire en base. Une URL secrète ne remplace jamais un contrôle d’accès. Le test avec deux comptes doit prouver leur séparation. Évite les données sensibles et les pièces inutiles ; rends possibles correction, export et suppression.

## Paiement et mise en ligne
Le prix à tester est ${idea.prix_conseille}. Utilise un lien de paiement hébergé chez Stripe et le modèle commercial annoncé. Pour ce petit pilote, active manuellement l’accès après vérification du paiement dans le tableau de bord, sans lire un simple paramètre de retour comme une preuve. Ne collecte aucune carte dans le produit. Distingue mode test et mode réel. Affiche les conditions et les coordonnées véritables du vendeur avant de vendre. Précise les frais de transaction et de fonctionnement. N’active aucun abonnement à un outil sans vérifier sa compatibilité avec le budget.

## Acquisition, aide et rythme
Le premier canal retenu est : ${acquisitionFor(idea, profile)} La communauté « ${excerpt(profile.communities)} » et l’audience « ${excerpt(profile.audience)} » sont des pistes déclarées, pas des clients acquis. ${profile.acceptsFace ? "Une présentation publique reste facultative selon le canal choisi." : "Ne propose aucune apparition publique du visage de la personne."} ${profile.acceptsCold ? "Les contacts individuels doivent rester pertinents et autorisés par le canal." : "Ne propose aucun message à froid ni envoi commercial non sollicité."} ${profile.videoSkill <= 2 || profile.dislikes.includes("video") ? "Privilégie des captures annotées pour démontrer le produit." : "Une courte capture vidéo de l’écran peut expliquer le parcours."} Rédige le produit en français. Garde les traductions pour après validation. Ajoute cinq réponses fréquentes pour limiter le support, tout en maintenant un contact humain.

## Critères d’acceptation
Le parcours principal fonctionne à 390 pixels et sur ordinateur, au clavier avec un focus visible. Une donnée enregistrée reste présente après rechargement. Deux comptes ne voient jamais les données de l’autre. Les formulaires refusent une saisie vide et expliquent la correction attendue. Les états de chargement, de réussite et d’échec sont explicites. Un paiement de test et un accès refusé sont vérifiés séparément. L’export restitue les informations lisiblement. Une sauvegarde est récupérable. La page ne promet rien qui ne fonctionne. Après dix conversations, réduis ou abandonne une fonction si elle ne répond à aucun problème confirmé. `;
  const words = countWords(prompt);
  if (words < 700 || words > 900) throw new Error(`Le modèle de démonstration doit contenir 700 à 900 mots (${words} actuellement).`);
  return prompt;
}

function buildDemoTasks(idea: Idea, profile: UserProfile): PlanTask[] {
  const channel = acquisitionFor(idea, profile);
  const weeks = [
    [
      `Définir une seule cible à interroger : ${idea.cible}`,
      `Trouver dix volontaires pour un échange via ce canal : ${channel}`,
      `Préparer quatre questions sur le dernier problème rencontré${profile.salesSkill <= 2 ? ", avec un script simple pour ne pas chercher à convaincre" : ", son coût et la solution utilisée aujourd’hui"}.`,
      "Mener cinq conversations réelles et noter les mots employés sans présenter le produit trop tôt.",
      "Mener cinq autres conversations et comparer les problèmes répétés aux cinq premiers retours.",
      `Décider de poursuivre, réduire ou arrêter le périmètre selon ces dix échanges${profile.risk === "faible" ? " ; ne construire que si un problème revient clairement" : " ; écrire l’hypothèse qui reste à tester"}.`,
    ],
    [
      `Copier le prompt et vérifier que le périmètre tient dans ${ideaRules[idea.id].effort_mvp_heures} heures, avec ${profile.budgetEuros} € de budget maximum.`,
      profile.codeLevel === "aucun" ? "Choisir un modèle no-code, vérifier ses limites gratuites et suivre sa configuration étape par étape." : "Préparer le projet guidé, la base et les variables de test avec un premier écran fonctionnel.",
      `Créer le parcours minimal : ${ideaRules[idea.id].scope}.`,
      "Configurer les champs indispensables et les permissions, puis vérifier la séparation avec deux comptes.",
      "Tester la création, la modification, la suppression et la reprise après rechargement sur téléphone.",
      `Corriger les erreurs bloquantes et écrire cinq réponses d’aide${profile.dislikes.includes("support") ? " pour réduire les demandes répétitives" : " pour accompagner les premiers essais"}.`,
    ],
    [
      "Mettre en ligne une version de test et vérifier le parcours sur un téléphone de 390 pixels.",
      `Créer un paiement en mode test pour l’offre « ${idea.prix_conseille} » et contrôler le montant affiché.`,
      "Vérifier paiement réussi, paiement annulé et accès refusé ; préparer les coordonnées vendeur et les conditions avant le mode réel.",
      `Inviter cinq bêta-testeurs volontaires par le canal retenu : ${channel}`,
      "Observer les cinq essais, noter les blocages et corriger d’abord ce qui empêche d’obtenir le résultat principal.",
      profile.videoSkill <= 2 || profile.dislikes.includes("video") ? "Créer une démonstration avec trois captures annotées et une page d’aide courte." : "Enregistrer une courte démonstration d’écran qui présente le résultat et les limites du produit.",
    ],
    [
      `Rédiger une offre simple : résultat concret, périmètre exact et prix à tester ${idea.prix_conseille}.`,
      `Activer le canal choisi avec une première ressource utile ou les échanges consentis : ${channel}`,
      profile.firstEuroDays === 30 ? "Proposer l’offre payante aux testeurs intéressés et suivre les réponses sans annoncer de résultat garanti." : `Recueillir les intentions d’achat et convenir d’une livraison compatible avec ton échéance de ${profile.firstEuroDays} jours avant d’encaisser.`,
      "Viser dix premiers clients payants en suivant les propositions, les objections et les paiements réellement confirmés.",
      "Demander un retour d’usage et une présentation consentie aux utilisateurs satisfaits, sans inventer de témoignage.",
      `Faire le bilan du mois : temps passé, dépenses, usage et ventes réelles ; décider ${profile.ambition === "complement" ? "du rythme d’entretien compatible avec ton activité" : "si les signaux justifient de poursuivre vers une activité principale"}.`,
    ],
  ];
  return weeks.flatMap((tasks, weekIndex) => tasks.map((libelle, position) => ({ id: `demo-${idea.id}-w${weekIndex + 1}-t${position + 1}`, semaine: weekIndex + 1, position: position + 1, libelle, done: false })));
}

/** Deterministic illustrative content. No API, secret, network or payment is used. */
export function generateDemoContent(answers: Answers = demoAnswers): DossierContent {
  const profile = buildProfile(answers);
  const matches = matchIdeas(profile).slice(0, 3);
  const selections: Selection[] = matches.map((idea, index) => {
    const effects = effectsFor(profile, idea);
    return {
      id: `demo-selection-${idea.id}`, idea_id: idea.id, idea_snapshot: idea, rang: index + 1,
      justification: `Cette piste reste sous tes plafonds : ${ideaRules[idea.id].effort_mvp_heures} heures de construction pour ${profile.weeklyHours} heures disponibles, et ${idea.budget_min_euros} € au départ pour un budget de ${profile.budgetEuros} €. ${effects.secteur} ${effects.types_produits}`,
      adaptation: `Commence uniquement par ${ideaRules[idea.id].scope}. ${effects.niveau_code} ${effects.ambition} Le prix est une hypothèse à valider avec la cible, jamais une estimation de revenu.`,
      canal_acquisition: acquisitionFor(idea, profile),
      risque: `${idea.difficulte_distribution >= 3 ? "Trouver des personnes prêtes à essayer puis à payer peut prendre plus de temps que la construction." : "La cible peut préférer son outil actuel, même si le problème existe."} ${effects.risque} ${profile.dislikes.includes("vente") ? "Une offre devra quand même être présentée : privilégie les échanges consentis et une page claire." : "Mesure l’intérêt à partir d’engagements concrets, pas de simples compliments."}`,
      reponses_citees: profile.evidence.filter((_, evidenceIndex) => evidenceIndex % 3 === index).map((evidence) => ({ question_id: evidence.question_id, reponse: evidence.reponse, effet: effects[evidence.question_id] })),
    };
  });
  return { selections, build_prompt: buildDemoPrompt(matches[0], profile), tasks: buildDemoTasks(matches[0], profile) };
}
