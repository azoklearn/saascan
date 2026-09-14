# Vérification de SaaScan

Vérification locale du 13 septembre 2026. Un compte est demandé avant le questionnaire. Les dossiers ne font appel à aucune IA : ils sont assemblés à partir des textes de `data/contenus`. SaaScan n’envoie aucun email. La clé Whop de production a servi à créer le catalogue et le webhook ; aucun paiement réel.

## Vérifications automatisées

```bash
npm test
npm run typecheck
npm run build
npm audit
```

Les 93 tests se répartissent ainsi :

- **Contenus (80 tests, 4 par idée) :** structure du fichier, longueurs, vouvoiement, apostrophe typographique, 60 accroches et déroulés distincts, au moins trois plateformes, aucun pourcentage dans les vidéos et le plan de A à Z, sept phases aux périodes imposées, et prompt de 700 à 900 mots pour chacun des 3 072 profils testés. Les prompts vont de 794 à 884 mots selon les idées et les profils.
- **Domaine :**
  - neuf questions et curseur final, réponses invalides ;
  - sélection des idées (assez d’idées, aucune, complément avec les plus proches) et remontée des domaines choisis ;
  - dossier assemblé pour deux profils : trois idées, citations des neuf réponses, prompt de 700 à 900 mots, 24 tâches distinctes, risques rédigés ;
  - adaptation du prompt aux compétences et à la zone ;
  - bonus de chaque formule : 0, 30 ou 60 vidéos, plan de A à Z avec l’objectif de revenu ;
  - canaux autorisés, prix par jour (0,63 €, 0,33 € et 0,19 €) et économies (−47 % et −69 %).
- **Base de données :** PostgreSQL/PGlite applique les huit migrations et le scénario `supabase/tests/rls.sql`. Le scénario couvre, en plus d’un paiement à 0 € obtenu avec un code promo (dossier ouvert, jamais compté comme remboursé, montant négatif refusé) :
  - la création des profils avec les comptes ;
  - l’absence de table de rappels et de colonnes d’email dans le journal des paiements ;
  - l’absence d’accès navigateur, même connecté (dossiers, bonus, profils, transactions) ;
  - le dossier et le paiement rattachés au compte au passage en caisse, et le refus d’un compte inconnu ;
  - le refus de publier avant paiement ;
  - le premier paiement Whop signalé pour la publication, avec l’email Whop enregistré, et la livraison répétée ;
  - les 60 idées de vidéos exigées pour la formule 12 mois, avec 30 refusées, et la remise à zéro des tentatives ;
  - le renouvellement et la résiliation conservée malgré un état plus ancien ;
  - le remboursement signalé une seule fois et conservé malgré un succès tardif ;
  - la réactivation d’un abonnement terminé, refusée pour un autre compte et acceptée pour le compte propriétaire.

Le build produit les pages `/inscription`, `/connexion` et `/espace`, les routes `/auth/callback` et `/auth/deconnexion`, et le middleware de session.

## Whop

`node scripts/whop-catalogue.mjs` a créé le produit masqué et les trois formules, sans frais initiaux : Whop affiche « €18.99 / month », « €29.99 / 3-months » et « €69.99 / year ». Une configuration de paiement d’essai renvoie une adresse `https://whop.com/checkout/ch_…/` et conserve ses métadonnées. Whop refuse une adresse de retour en `http://` : le paiement ne se teste pas sur localhost.

`node scripts/whop-webhook.mjs https://saascan.vercel.app` a créé le webhook vers `/api/webhooks/whop` avec six événements ; Whop refuse `membership.went_valid` et `membership.went_invalid`. Le secret est enregistré dans `.env.local` sans être affiché. En production, la route refuse une requête sans signature Whop.

## Parcours navigateur vérifié

Navigateur intégré, à 309 pixels de large, à 375 × 812 pixels et à 1280 × 800 pixels :

1. **Compte obligatoire :**
   - `/questionnaire` redirige vers `/inscription?suite=%2Fquestionnaire` ;
   - `/espace` redirige vers `/inscription?suite=%2Fespace` ;
   - `/questionnaire?demo=1` reste ouvert sans compte.
2. **Création de compte (`/inscription`) :**
   - logo, « Créez votre compte. », bouton « Continuer avec Google », champs email et mot de passe (8 caractères minimum) et lien « Se connecter » qui conserve la suite ;
   - aucun en-tête du site en double, aucun débordement horizontal ;
   - sans clé publishable locale, le formulaire et le bouton Google affichent « La connexion n’est pas encore configurée sur ce site. ».
3. **Connexion (`/connexion`) :** « Connectez-vous. », bouton « Se connecter », mention « Mot de passe oublié ? Écrivez-nous… », lien « Créer un compte » qui conserve la suite.
4. **Menu du site :** « Se connecter » sans session, vers `/connexion`, sur ordinateur et dans le menu mobile.
5. **Hero :** téléphone animé (flottement, ombre, notification toutes les trois secondes environ), sans débordement à 375 et 1280 pixels.
6. **Offre (`/debloquer?demo=1`) :**
   - trois formules, chacune avec son prix barré de référence mensuelle, son pourcentage, son prix par jour et son contenu (30 idées de vidéos pour 3 mois, 60 et le plan de A à Z pour 12 mois) ;
   - badge « Recommandé » sur 3 mois.
7. **Dossier d’exemple (`/dossier/demo`) :**
   - RDVFacile avec cinq onglets, dont « Vidéos marketing » (60 idées) et « Plan de A à Z » (sept phases de A à G) ;
   - prompt de 813 mots ;
   - tâche cochée conservée après rechargement ;
   - aucun texte des autres idées dans le HTML ni dans les scripts chargés.

La connexion réelle (Google et email), l’espace avec un dossier payé et le bloc « Ce dossier reste dans votre espace » restent à voir avec la clé publishable et un premier paiement.

## À vérifier avec les services configurés

- Migrations `202609130004_sans_emails.sql` et `202609130005_comptes.sql` appliquées sur la base Supabase.
- Connexion :
  - « Confirm email » désactivé ;
  - création de compte par email puis connexion ;
  - « Continuer avec Google » avec retour sur la suite du parcours ;
  - déconnexion depuis l’espace.
- Paiement réel ou dans le bac à sable Whop :
  - dossier rattaché au compte et visible dans `/espace` ;
  - retour sur `/dossier/<lien>` et publication immédiate du dossier et des bonus ;
  - webhook répété, renouvellement, passage de 3 à 12 mois ;
  - case de renonciation à la rétractation obligatoire avant le paiement et avant la réactivation ;
  - résiliation depuis le dossier, puis fin de l’accès à l’échéance ;
  - réactivation, avec reconnexion si la session a expiré.

Ces cas ont été revus dans le code et vérifiés par TypeScript et par le scénario SQL, mais restent à exercer avec Supabase Auth, Google et Whop.
