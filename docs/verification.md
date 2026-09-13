# Vérification de SaaScan

Vérification locale du 13 septembre 2026, sans clés de services : aucun paiement, aucune génération et aucun email réel.

## Vérifications automatisées

```bash
npm test
npm run typecheck
npm run build
npm audit
```

Les 15 tests couvrent les neuf questions et le curseur final, les réponses invalides (option inconnue, plus de trois domaines, montant hors du curseur), la sélection des idées quand il y en a assez, quand aucune ne convient et quand il faut compléter avec les plus proches, la remontée des domaines choisis, un dossier complet pour plusieurs profils (trois idées, prompt de 700 à 900 mots, 24 tâches, toutes les réponses citées) et le contrat de génération (idée inventée, faux verbatim, réponse oubliée, canal incompatible, champ injecté). PostgreSQL/PGlite applique les trois migrations et le scénario `supabase/tests/rls.sql` : aucun accès navigateur, dossier créé au passage en caisse, génération refusée avant paiement, webhook répété, email avec lien et remboursement.

## Parcours navigateur vérifié

Navigateur intégré, sur ordinateur (1440 × 900) et à 390 × 844 pixels :

1. `/` : titre sans débordement ; « Créer mon SaaS », dans l’en-tête et le hero, mène à `/questionnaire` ; les chiffres affichent 20 idées et 9 questions.
2. `/questionnaire` : les deux écrans d’introduction, puis les neuf questions. Le compteur suit les réponses données ; les pastilles reprennent les réponses précédentes.
3. Domaines : grille sur deux colonnes sur ordinateur, une colonne sur mobile ; à « 3 sur 3 sélectionnés », les autres choix sont bloqués.
4. Curseur : 2 000 € par défaut, flèches du clavier (5 000 €), glisser à la souris (20 000 €). La valeur est enregistrée dans le navigateur ; après rechargement, le questionnaire reprend à la dernière question avec les pastilles.
5. « Lancer l’analyse » : animation en quatre étapes, puis `/debloquer` avec l’écran « Prêt », « Lancer mon SaaS » et l’offre à 39 €.
6. Sans clé Stripe, le paiement affiche « Service non configuré » et un lien vers le dossier de démonstration.
7. `/dossier/demo?demo=1` : trois idées, prompt et plan au vouvoiement, sans mention d’idée incompatible pour un profil qui n’en avait aucune (non technique, moins d’une heure par jour, zone anglophone). Pas de débordement horizontal à 390 pixels ; les onglets défilent dans leur propre zone.

Profil principal : 25 à 34 ans, B2B, Vente & CRM + Marketing & acquisition + Trading & marchés, non technique, moins d’une heure par jour, anglophone, facturation à l’usage, « Ça dépend du problème », 20 000 € par mois. Profil mobile : 18 à 24 ans, SaaScan décide, Santé & bien-être, application complète, journée entière, francophone, abonnement, besoin inexploré.

## À vérifier avec les services configurés

- Paiement Stripe de test : création du dossier, retour sur `/dossier/<lien>`, webhook, email avec le lien, préparation par l’IA, annulation (retour sur l’offre), webhook répété et remboursement depuis le dossier.
- Génération Anthropic réelle : durée, réponse invalide, relance après échec, préparation interrompue plus de quatre minutes et échec définitif après trois tentatives.
- Envoi Resend, nouvel essai après erreur et exécution du cron Vercel.
- Téléchargement du prompt et tâches cochées avec un vrai lien de dossier.

Ces cas ont été revus dans le code et vérifiés par TypeScript et par le scénario SQL, mais restent à exercer avec les API réelles.
