# Contenus rédigés à l’avance

Aucun dossier n’est écrit par une IA au moment de l’achat. Pour chaque idée de `data/ideas.json`, le fichier `data/contenus/<id>.json` contient des textes rédigés une fois pour toutes. `src/lib/dossier/content.ts` les assemble avec les réponses du questionnaire : trois idées argumentées, un prompt de construction de 700 à 900 mots, un plan sur 30 jours, 30 idées de vidéos (formule 3 mois), 60 idées de vidéos et un plan de A à Z (formule 12 mois).

Référence : `data/contenus/budget-mensuel.json`.

Contrôle : `npx vitest run tests/contenus.test.ts -t <id>` (les quatre tests de l’idée doivent passer).

## Structure

```json
{
  "idea_id": "<id identique au nom du fichier>",
  "risque": "…",
  "prompt": { "produit": "…", "ecrans": ["…"], "donnees": "…", "criteres": ["…"] },
  "construction": ["…", "…", "…", "…"],
  "videos": [{ "plateforme": "…", "format": "…", "accroche": "…", "deroule": "…", "appel_action": "…" }],
  "roadmap": [{ "titre": "…", "periode": "Mois 1", "objectif": "…", "actions": ["…"], "indicateur": "…" }]
}
```

## Règles d’écriture (toutes les parties)

- Français soigné, **vouvoiement** partout (jamais tu, ton, ta, tes, toi, te, t’). Le prompt s’adresse à l’outil de construction à l’impératif (« Prévois… »), sans pronom de tutoiement.
- Apostrophe typographique `’`, jamais `'`. Guillemets « » avec espaces. Pas de `...` : utiliser `…`.
- **Honnêteté** : aucun chiffre de marché, de vues, d’abonnés, de revenus, de taux ou de temps gagné inventé ; aucun pourcentage dans les vidéos ni dans le plan de A à Z ; aucune promesse de résultat ; aucun faux témoignage ; aucune fausse urgence. Les seuls chiffres autorisés viennent de l’idée (prix, périmètre) ou sont des objectifs de travail présentés comme tels (« dix entretiens », « trois vidéos par semaine »).
- Rester dans le périmètre de l’idée (`scope` dans `src/lib/matching/idea-rules.ts`) et respecter ce qu’elle exclut (pas de données de santé, pas de publication automatique, etc.).
- Tout doit être faisable **seul**, avec peu de temps et sans budget publicitaire.
- Le texte doit être spécifique à l’idée : sa cible, ses situations de tous les jours. Une phrase qui marcherait pour n’importe quel produit est à réécrire.
- **Grand public** : une personne sans culture startup ni technique doit tout comprendre à la première lecture. Phrases courtes, mots de tous les jours, exemples du quotidien. Aucun jargon : pas de MVP (dire « première version »), churn, onboarding, B2B, B2C, KPI, funnel, growth, lead ni SaaS (dire « appli », « outil » ou le nom du produit) ; le test les refuse. Un terme technique indispensable est expliqué en quelques mots. Seul le prompt, destiné à l’outil de construction, peut rester précis sur les écrans et les données, mais toujours en français clair.

## `risque` (150 à 600 caractères)

Le principal risque de l’idée, puis un petit test concret pour le réduire. Deux ou trois phrases.

## `prompt` (assemblé dans le prompt de construction)

L’application ajoute automatiquement la cible, le périmètre, le temps, l’outil guidé, le délai de la première vente, le paiement, le canal d’acquisition, la langue et trois critères génériques. Ne pas les répéter. Écrire seulement ce qui est propre au produit :

- `produit` (60 à 130 mots, viser 70 à 85) : ce que fait le produit, le parcours principal, qui l’utilise, et ce qu’il ne fait pas.
- `ecrans` (5 ou 6 écrans, 15 à 50 mots chacun, viser 25 à 32) : « Nom de l’écran : ce qu’on y voit et ce qu’on y fait », avec les états vides ou d’erreur utiles. Pas de numéro, l’application numérote.
- `donnees` (45 à 110 mots, viser 60 à 75) : entités, champs, relations, et qui voit quoi.
- `criteres` (4 à 6 critères, 8 à 30 mots chacun, viser 10 à 16) : critères d’acceptation observables et propres à l’idée.

**Budget total** de ces quatre parties : environ 340 à 410 mots. Le test calcule le prompt complet pour 256 profils et exige 700 à 900 mots pour chacun ; il affiche la fourchette obtenue.

## `construction` (exactement 4 tâches, 50 à 260 caractères)

Les tâches de construction de la semaine 2, après « copier le prompt » et « préparer l’outil » ajoutées par l’application. Concrètes, cochables, sans nom d’outil imposé. La dernière fait tester le produit par quelques personnes.

## `videos` (exactement 60)

Des idées de vidéos courtes pour faire connaître **ce produit** auprès de **sa cible**. La formule 3 mois reçoit les 30 premières : mettre en tête les plus fortes et les plus variées.

- `plateforme` : `TikTok`, `Instagram Reels`, `YouTube Shorts` ou `LinkedIn`. Choisir selon l’endroit où la cible se trouve vraiment. Au moins trois plateformes au total, au moins deux dans les 30 premières.
- `format` (3 à 40 caractères) : libellé court. Au moins huit formats différents dans les 30 premières. Exemples : Problème vécu, Démonstration à l’écran, Avant et après, Coulisses de la construction, Erreur fréquente, Question de la cible, Comparaison, Tutoriel express, Checklist, Idée reçue, Journée type, Exemple fictif commenté, Retour de testeur, Transparence sur le prix, Réponse à un commentaire, Série.
- `accroche` (15 à 160 caractères) : la phrase exacte dite ou affichée dans les trois premières secondes. Toutes différentes.
- `deroule` (150 à 650 caractères) : deux à quatre phrases qui décrivent les plans et ce qui est montré à l’écran. Préciser quand la vidéo se tourne sans visage (écran, mains, texte). Tout exemple inventé est présenté comme fictif ; tout retour client est réel et utilisé avec accord.
- `appel_action` (15 à 200 caractères) : simple et honnête (tester la bêta, répondre en commentaire, rejoindre la liste d’attente, écrire en message privé, enregistrer la vidéo).

Répartition indicative : environ 40 % de vidéos utiles à la cible même sans le produit (conseils, erreurs, checklists), 35 % de démonstrations et de coulisses, 25 % d’offre, de retours et d’échanges avec la communauté.

## `roadmap` (exactement 7 phases)

Le plan de A à Z sur douze mois, propre à l’idée. Périodes imposées, dans l’ordre : `Mois 1`, `Mois 2`, `Mois 3`, `Mois 4 à 5`, `Mois 6 à 7`, `Mois 8 à 10`, `Mois 11 à 12`.

Enchaînement attendu : vérifier que le problème existe ; construire la première version ; lancer et trouver les premiers clients payants ; publier des vidéos régulièrement ; ajuster le prix et fidéliser ; trouver un canal qui se répète (partenaires, prescripteurs, communautés propres à la cible) ; automatiser et faire le bilan.

- `titre` (8 à 70 caractères), `objectif` (60 à 400 caractères), `actions` (3 à 5, 30 à 260 caractères chacune), `indicateur` (30 à 240 caractères, un signal observable pour passer à la phase suivante).
- Deux balises sont remplacées selon le profil : `{objectif_revenu}` (par exemple « 2 000 € par mois ») et `{heures_par_semaine}` (par exemple « 7 »). `{objectif_revenu}` doit apparaître au moins une fois, en général dans la dernière phase. Aucune autre balise.
