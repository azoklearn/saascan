# Backend SaaScan

Le backend utilise Supabase (comptes et base de données) et Whop réellement configurés. Il n’appelle aucune IA : les dossiers sont assemblés à partir de textes rédigés à l’avance (`data/contenus`). Il n’envoie aucun email. Il ne fournit aucune donnée payante ni transaction fictive. Le dossier de démonstration est assemblé pour un profil fictif fixe.

## Configuration

Copier `.env.example` dans `.env.local`, remplir les valeurs, puis redémarrer Next.js. Les variables absentes entraînent une réponse JSON `503 NOT_CONFIGURED`.

Appliquer dans cet ordre les migrations `202609120001_initial_schema.sql`, `202609120002_server_transactions.sql`, `202609130001_parcours_sans_compte.sql`, `202609130002_abonnements_whop.sql`, `202609130003_contenus_rediges.sql`, `202609130004_sans_emails.sql`, `202609130005_comptes.sql` et `202609130006_paiements_gratuits.sql`. La troisième retire les droits navigateur, ajoute le lien d’accès secret et impose la publication après paiement. La quatrième passe aux abonnements Whop. La cinquième retire les lots quotidiens de vidéos et fixe le nombre d’idées de vidéos par formule (30 ou 60). La sixième supprime le journal d’envoi d’emails et les rappels de renouvellement. La septième rattache chaque nouveau dossier à un compte.

## Comptes

Supabase Auth gère les comptes : « Continuer avec Google » et email avec mot de passe, sans email de confirmation (« Confirm email » désactivé dans le projet). Le navigateur utilise la clé publishable (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) uniquement pour se connecter ; la session vit dans des cookies gérés par `@supabase/ssr`.

`src/middleware.ts` rafraîchit la session et redirige vers `/inscription?suite=<chemin>` toute visite sans compte de `/questionnaire`, `/analyse`, `/debloquer` et `/espace`, sauf en démonstration (`?demo=1`). Une personne connectée qui ouvre `/inscription` ou `/connexion` repart vers `suite`. `suite` n’accepte qu’un chemin interne.

Google renvoie vers `GET /auth/callback`, qui échange le code contre une session puis reprend le parcours ; en cas d’échec, `/inscription?erreur=google` affiche un message. `POST /auth/deconnexion` ferme la session. `/espace` lit l’utilisateur côté serveur et liste ses dossiers payés, avec leur formule et l’état de l’abonnement.

Le déclencheur de la première migration crée un profil pour chaque compte ; `private.ensure_profile` le recrée si besoin au passage en caisse. Les données restent lues et écrites par le serveur avec la clé `service_role` : les rôles `anon` et `authenticated` n’ont aucun droit sur les tables ni sur les fonctions, même connectés.

## Modèle d’accès

Le questionnaire ne parle pas au serveur : les réponses restent dans le stockage local jusqu’au paiement. `POST /api/checkout` exige une session (`401 UNAUTHENTICATED` sinon), valide les neuf réponses et la formule, génère un lien d’accès de 32 octets aléatoires (43 caractères base64url) et appelle `start_checkout`, qui crée dans une transaction le dossier du compte, ses réponses et le paiement en attente au prix de la formule. Avec un lien de dossier à la place des réponses, `reopen_checkout` prépare la réactivation d’un abonnement terminé ; elle est refusée pour un dossier appartenant à un autre compte, et rattache au compte un dossier créé avant les comptes.

Le lien du dossier ouvre son contenu sans connexion : il figure dans l’URL de retour Whop et dans l’espace du compte, jamais dans les métadonnées transmises à Whop. Le dossier et l’espace demandent `no-referrer` pour que ces liens ne partent pas vers un autre site. Un lien au mauvais format produit la même réponse 404 qu’un lien inconnu.

Le contenu (sélections, prompt, tâches, vidéos, plan de A à Z) n’est renvoyé que si le dossier est prêt, que son premier paiement est confirmé et non remboursé, et que l’abonnement est `active`, `trialing`, `past_due` ou `canceling`. Un abonnement pas encore relu juste après le paiement ne bloque pas l’accès. Les vidéos affichées se limitent au nombre inclus dans la formule actuelle.

## Contrat des routes

Les écritures venant du navigateur contrôlent l’origine. Les réponses JSON et les exports sont servis avec `Cache-Control: private, no-store`.

| Route | Entrée | Sortie |
|---|---|---|
| `POST /api/checkout` | Session + `{formule, answers}` ou `{formule, token}` | `{url}` |
| `GET /api/dossiers/[lien]` | — | `{dossier, access, content?}` |
| `POST /api/generate` | `{token, part?}` (`dossier` ou `bonus`) | `{ok:true}` |
| `PATCH /api/dossiers/[lien]/taches/[id]` | `{done}` | `{ok:true}` |
| `GET /api/dossiers/[lien]/export` | — | Prompt Markdown téléchargé |
| `POST /api/abonnement` | `{token}` | `{ok:true}` |
| `POST /api/remboursement` | `{token}` | `{ok:true,status}` |
| `POST /api/webhooks/whop` | Corps Whop brut + en-têtes `webhook-*` | `{received:true}` |
| `GET /auth/callback` | `code`, `suite` | Redirection |
| `POST /auth/deconnexion` | Session | Redirection vers l’accueil |

`POST /api/checkout` est limité à dix demandes par adresse IP sur dix minutes, par instance.

Sans `WHOP_API_URL`, le client Whop vise la production. Les informations du vendeur ne bloquent pas le passage en caisse ; tant qu’elles manquent, les pages légales restent en version préparatoire. Whop refuse une adresse de retour qui ne commence pas par `https://` : le passage en caisse renvoie `503 NOT_CONFIGURED` sur `http://localhost`. Les pages légales restent à compléter et vérifier pour l’éditeur réel.

Les erreurs suivent `{error,code?}`.

## Publication du dossier

Le dossier n’est publié qu’après paiement. `reserve_generation` refuse un dossier non payé ou remboursé, verrouille le dossier et renvoie un instantané des réponses ; la contrainte `dossiers_generation_after_payment` empêche aussi tout passage en préparation d’un dossier impayé. Le serveur valide l’instantané, puis `buildDossierContent` assemble le contenu sans aucun appel externe.

L’assemblage (`src/lib/dossier/content.ts`) choisit trois idées de façon déterministe (`src/lib/matching`), écrit la justification, l’adaptation et les citations des neuf réponses à partir de phrases types, reprend le risque rédigé pour chaque idée, puis compose le prompt de l’idée n°1 : sections rédigées (produit, écrans, données, critères) et sections qui dépendent du profil (temps, objectif de revenu, stack selon les compétences, facturation, langue, canal). Les tâches de la semaine 2 reprennent les étapes de construction rédigées pour l’idée. Quand moins de trois idées respectent les compétences, le temps et la zone, les plus proches complètent la liste sans que l’écart soit signalé.

Le webhook de paiement publie le dossier puis les bonus après avoir répondu à Whop, avec `after()` de Next.js. La page du dossier interroge l’état et appelle `POST /api/generate` si un dossier payé n’est pas prêt, puis avec `part: "bonus"` tant que les bonus de la formule manquent. Un conflit 409 signifie qu’une publication est déjà en cours.

`publish_generation` insère les trois sélections, le prompt de 700–900 mots et les quatre semaines de tâches dans une même transaction, puis rend le dossier prêt. Le numéro de tentative empêche une ancienne tentative de remplacer une plus récente, et trois échecs mènent à l’état d’échec avec remboursement proposé.

Les bonus suivent le même modèle : `reserve_extras` détermine ce qui manque selon la formule (30 idées de vidéos pour 3 mois, 60 et le plan de A à Z pour 12 mois), `publish_extras` vérifie le nombre d’idées et publie tout ou rien, `fail_extras` libère la réservation. Un passage de 3 à 12 mois complète les bonus manquants ; un succès remet le compteur d’échecs à zéro. Dans le plan de A à Z, `{objectif_revenu}` et `{heures_par_semaine}` sont remplacés selon le profil.

`tests/contenus.test.ts` contrôle les vingt fichiers rédigés (structure, longueurs, vouvoiement, accroches distinctes, aucun pourcentage dans les vidéos et le plan) et calcule le prompt de chaque idée pour 3 072 profils.

## Whop

Les prix sont fixés par `src/config/plans.json` et par les formules créées sur Whop avec `scripts/whop-catalogue.mjs` : renouvellement tous les 30, 90 ou 365 jours, en euros, sans frais initiaux. Chaque passage en caisse crée une configuration de paiement Whop pour la formule choisie, avec `dossier_id` et `payment_id` en métadonnées et `/dossier/[lien]` comme adresse de retour.

`scripts/whop-webhook.mjs` abonne le webhook aux événements `payment.succeeded`, `membership.activated`, `membership.deactivated`, `membership.cancel_at_period_end_changed`, `refund.created` et `refund.updated`, et écrit son secret `ws_…` dans `WHOP_WEBHOOK_SECRET`. Whop refuse `membership.went_valid` et `membership.went_invalid`.

La route vérifie la signature Standard Webhooks du corps brut avec `unwrapWebhook`, puis relit chez Whop l’état actuel du paiement et de l’abonnement : le contenu de la livraison ne sert qu’à identifier les objets. Un paiement doit porter l’une des trois formules, être en euros et avoir une date de paiement. `apply_whop_event` déduplique les livraisons par `webhook-id` et modifie dans une transaction le paiement, le droit d’accès et l’état de l’abonnement. Le premier paiement ouvre le dossier (`first_payment`) ; un renouvellement ajoute un paiement au même dossier. Le remboursement confirmé du premier paiement ferme l’accès (`refund_confirmed`). Un succès arrivé après un remboursement ne réactive pas l’accès, et un état d’abonnement relu plus tôt ne remplace pas un état plus récent. Whop attend une réponse en moins de cinq secondes : la publication et l’annulation d’un abonnement remboursé continuent après la réponse.

Si un webhook manque, `GET /api/dossiers/[lien]` relit l’abonnement chez Whop quand l’état connu date de plus de dix minutes, ou quand la période est échue alors que l’abonnement paraît encore valide.

`POST /api/abonnement` résilie en fin de période et enregistre aussitôt le nouvel état. `POST /api/remboursement` accepte un premier paiement de moins de 48 heures, identifié par le lien du dossier : il arrête d’abord le renouvellement, puis demande à Whop le remboursement intégral. Le navigateur ne peut définir aucun montant. L’accès n’est fermé qu’après confirmation du remboursement par webhook ; les téléchargements déjà effectués ne peuvent pas être révoqués.

Aucun rappel n’est envoyé avant le renouvellement ; la date du prochain renouvellement est affichée dans le dossier et dans l’espace. Les obligations d’information applicables aux formules reconduites tacitement restent à vérifier par l’éditeur.

Les clés service-role et Whop restent côté serveur. Les fonctions SQL privilégiées ont explicitement perdu le droit `EXECUTE` public et ne sont appelables que par `service_role`.

## Vérification

Avec une base locale migrée, exécuter `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql`. Le test vérifie les comptes et leurs profils, l’absence d’accès navigateur et de traces d’emails, le dossier rattaché au compte au passage en caisse, le refus d’un compte inconnu, le refus de publier avant paiement, les bonus de la formule 12 mois, le renouvellement, la résiliation, les webhooks répétés ou tardifs, le remboursement et la réactivation réservée au compte propriétaire. Il se termine par `ROLLBACK`.

Les essais réels de Whop, des webhooks et de la connexion avec Google nécessitent les comptes des fournisseurs. Aucune clé ou infrastructure réelle n’est incluse dans ce dépôt.
