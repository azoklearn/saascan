# Vérification de SaaScan

Vérification locale du 13 septembre 2026. Aucun compte, paiement ou message réel n’a été créé pendant ces essais.

## Vérifications automatisées

```bash
npm test
npm run typecheck
npm run build
npm audit
```

Les 17 tests couvrent les réponses, les contraintes de faisabilité, les citations, les 700 à 900 mots du prompt, la structure du plan, les canaux autorisés et plusieurs formulations incompatibles avec le profil. PostgreSQL/PGlite applique les deux migrations réelles et le scénario RLS : séparation entre comptes, accès avant/après paiement et remboursement, champs protégés et événements de paiement répétés ou tardifs.

Le canal d’acquisition est construit côté serveur à partir de l’idée, du profil et du canal autorisé choisi. Un contrôle lexical supplémentaire rejette certaines propositions incompatibles dans les textes générés. Ce contrôle conservateur ne garantit pas une compréhension exhaustive des paraphrases produites par un modèle.

## Parcours navigateur vérifié

Vérifications effectuées dans le navigateur intégré, sur ordinateur et à 390 × 844 pixels :

1. Ouvrir `/`. Vérifier le titre, les boutons, le décor SVG et l’absence de débordement horizontal. Le décor comporte les onze courbes de l’extrait utilisateur ; le fichier fourni ne contenait pas le reste de la landing de référence.
2. Sur mobile, ouvrir le menu, choisir « Questions », développer une réponse de FAQ et vérifier la lisibilité.
3. Choisir « Voir un exemple », puis « Mon espace ». Créer un nouveau scan de démonstration. Parcourir les deux introductions avec « Continuer » puis « Répondre au questionnaire ». Les nouveaux écrans reprennent les captures fournies ; les vingt questions et le paiement unique à 39 € sont conservés.
4. Répondre aux questions. Recharger après une réponse enregistrée et revenir depuis l’espace : les réponses persistent et le questionnaire reprend à la première réponse manquante. La reprise à la question 13 a été vérifiée avec douze réponses sauvegardées.
5. Terminer les vingt réponses avec le profil ci-dessous. L’analyse circulaire de démonstration mène à un écran « Prêt ». La progression est présentée comme une estimation en mode réel. La mention de démonstration reste visible et aucun paiement n’est demandé.
6. Choisir « Lancer mon SaaS », puis « Ouvrir le dossier de démonstration ». Vérifier trois idées, un canal concret, le prompt et les quatre semaines du plan.
7. Copier le prompt : le bouton affiche « Copié ! ». Cocher la première tâche, recharger et rouvrir le plan : le compteur indique 1/24 et la case reste cochée. Le dossier ne déborde pas à 390 pixels.

Profil utilisé : 10 heures par semaine, 50 € de budget, aucun revenu en ligne antérieur, premier euro visé en 30 jours, aucun niveau de code, aisance IA 3/5, design 2/5, vente 2/5, vidéo 1/5, métier dans la rénovation, communauté d’artisans, aucune audience, réseau de 6 à 20 personnes, français, refus de montrer son visage et du démarchage à froid, faible risque, préférences B2B et automatisation, vidéo comme tâche détestée, complément de revenu comme ambition.

La nouvelle présentation a été parcourue de bout en bout sur ordinateur et mobile. Une pastille a permis de revenir à la première réponse ; son choix était conservé. Un rechargement a ensuite retrouvé la première question manquante. Les choix multiples se présentent en grille sur ordinateur et en colonne sur mobile. Le cercle de progression a été inspecté pendant une génération de démonstration.

Les contrôles de formulaire s’appuient sur les champs natifs et la validation serveur. Les onglets du dossier gèrent les flèches, Début et Fin ; les focus sont visibles et les animations respectent la préférence de mouvement réduit. Ces dispositions ne constituent pas une certification d’accessibilité complète.

## À vérifier avec les services configurés

Les clés des services n’étant pas présentes, les étapes suivantes n’ont pas été exécutées contre les fournisseurs réels :

- Connexion Supabase par email, expiration du lien et reprise de session.
- Génération Anthropic réelle, réponse invalide, indisponibilité du modèle, reprise d’une génération en cours et délai dépassé.
- Paiement Stripe de test, annulation, signature invalide, retour avant webhook, remboursement et isolement de deux comptes authentifiés.
- Envoi Resend, nouvel essai après erreur et exécution du cron Vercel.
- Téléchargement authentifié du prompt depuis l’API et refus d’accès depuis un autre compte.

La page de dossier gère un paiement enregistré sans contenu par un message récupérable et un bouton « Réessayer ». Une analyse déjà réservée est observée toutes les deux secondes ; un conflit 409 rejoint cette attente. Ces cas ont été revus dans le code et vérifiés par TypeScript, mais restent à exercer avec les API réelles.

Le README décrit les variables, migrations et réglages nécessaires. Les informations du vendeur restent à compléter avant commercialisation. Le serveur refuse une clé Stripe live tant que les champs d’identité requis et l’email de contact sont absents.
