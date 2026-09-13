# Vérification de SaaScan

Vérification locale du 13 septembre 2026. Les dossiers ne font appel à aucune IA : ils sont assemblés à partir des textes de `data/contenus`. La clé Whop de production a servi à créer le catalogue ; aucun paiement et aucun email réel.

## Vérifications automatisées

```bash
npm test
npm run typecheck
npm run build
npm audit
```

Les 93 tests se répartissent ainsi :

- **Contenus (80 tests, 4 par idée) :** structure du fichier, longueurs, vouvoiement, apostrophe typographique, 60 accroches et déroulés distincts, au moins trois plateformes, aucun pourcentage dans les vidéos et le plan de A à Z, sept phases aux périodes imposées, et prompt de 700 à 900 mots pour chacun des 3 072 profils testés. Les prompts vont de 794 à 884 mots selon les idées et les profils.
- **Domaine :** neuf questions et curseur final, réponses invalides, sélection des idées (assez d’idées, aucune, complément avec les plus proches), remontée des domaines choisis, dossier assemblé pour deux profils (trois idées, citations des neuf réponses, prompt de 700 à 900 mots, 24 tâches distinctes, risques rédigés), adaptation du prompt aux compétences et à la zone, bonus de chaque formule (0, 30 ou 60 vidéos, plan de A à Z avec l’objectif de revenu), canaux autorisés, prix par jour (0,63 €, 0,33 € et 0,19 €) et économies (−47 % et −69 %).
- **Base de données :** PostgreSQL/PGlite applique les cinq migrations et le scénario `supabase/tests/rls.sql`. Le scénario couvre :
  - l’absence d’accès navigateur ;
  - la création du dossier au passage en caisse ;
  - le refus de publier avant paiement ;
  - le premier paiement Whop et la livraison répétée ;
  - l’email avec le lien ;
  - les 60 idées de vidéos exigées pour la formule 12 mois, avec 30 refusées ;
  - la remise à zéro des tentatives ;
  - le renouvellement et le rappel de reconduction ;
  - la résiliation conservée malgré un état plus ancien ;
  - le remboursement conservé malgré un succès tardif ;
  - la réactivation d’un abonnement terminé.

## Catalogue Whop

`node scripts/whop-catalogue.mjs` a créé le produit masqué et les trois formules, sans frais initiaux : Whop affiche « €18.99 / month », « €29.99 / 3-months » et « €69.99 / year ». Une configuration de paiement d’essai renvoie une adresse `https://whop.com/checkout/ch_…/` et conserve ses métadonnées. Whop refuse une adresse de retour en `http://` : le paiement ne se teste pas sur localhost.

## Parcours navigateur vérifié

Navigateur intégré, à 309 pixels de large puis à 375 × 812 pixels :

1. **Offre (`/debloquer?demo=1`, après le questionnaire) :**
   - bandeau « −69 % avec la formule 12 mois, par rapport au mensuel » et garantie 48 h ;
   - trois formules, chacune avec son prix barré de référence mensuelle, son pourcentage, son prix par jour et son contenu (30 idées de vidéos pour 3 mois, 60 et le plan de A à Z pour 12 mois) ;
   - badge « Recommandé » sur 3 mois, sélection d’une formule à l’autre, aucun débordement horizontal.
2. **Offre sans démo (`/debloquer`) :** les conditions rappellent le renouvellement de la formule choisie, et « Continuer » affiche en local « Whop exige une adresse HTTPS… ».
3. **Dossier d’exemple (`/dossier/demo`) :**
   - BriefChantier avec cinq onglets, dont « Vidéos marketing » (60 idées) et « Plan de A à Z » (sept phases de A à G) ;
   - prompt de 813 mots ;
   - objectif de revenu remplacé dans la dernière phase, sans balise restante ;
   - tâche cochée conservée après rechargement ;
   - pas de bloc d’abonnement en démonstration, aucun débordement horizontal.
4. **Contenu payant :** ni le HTML ni les scripts chargés par le dossier d’exemple ne contiennent le texte des autres idées. Les contenus restent côté serveur.

Le questionnaire et l’analyse n’ont pas changé depuis la vérification précédente.

## À vérifier avec les services configurés

- Migration `202609130003_contenus_rediges.sql` appliquée sur la base Supabase.
- Webhook Whop vers l’adresse Vercel, puis paiement :
  - retour sur `/dossier/<lien>` et publication immédiate du dossier et des bonus ;
  - email avec le lien ;
  - webhook répété ;
  - renouvellement ;
  - passage de 3 à 12 mois ;
  - résiliation depuis le dossier ;
  - remboursement sous 48 heures ;
  - réactivation.
- Envoi Resend, reprise après erreur, rappel de reconduction et exécution du cron Vercel.
- Téléchargement du prompt et tâches cochées avec un vrai lien de dossier.

Ces cas ont été revus dans le code et vérifiés par TypeScript et par le scénario SQL, mais restent à exercer avec les API réelles.
