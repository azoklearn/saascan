# Backend SaaScan

Le backend utilise Supabase, Stripe, Anthropic et Resend réellement configurés. Il ne fournit aucune génération, donnée payante ou transaction fictive. Le mode démonstration reste dans le stockage local du navigateur.

## Configuration

Copier `.env.example` dans `.env.local`, remplir les valeurs, puis redémarrer Next.js. Les variables absentes entraînent une réponse JSON `503 NOT_CONFIGURED`.

Appliquer dans cet ordre les migrations `202609120001_initial_schema.sql`, `202609120002_server_transactions.sql` et `202609130001_parcours_sans_compte.sql`. La troisième remplace le modèle à comptes : dossiers sans utilisateur, lien d’accès secret, email de l’acheteur, suppression des droits navigateur et génération après paiement. Elle s’applique aussi sur une base déjà migrée et conserve l’historique éventuel.

Supabase Auth n’est pas utilisé.

## Modèle d’accès

Le questionnaire ne parle pas au serveur : les réponses restent dans le stockage local jusqu’au paiement. `POST /api/checkout` valide les neuf réponses, génère un lien d’accès de 32 octets aléatoires (43 caractères base64url) et appelle `start_checkout`, qui crée dans une transaction le dossier, ses réponses et le paiement en attente.

Toutes les routes utilisent la clé `service_role` côté serveur ; les rôles `anon` et `authenticated` n’ont plus aucun droit sur les tables ni sur les fonctions. Le lien du dossier est la seule autorisation : il figure dans l’URL de retour Stripe et dans l’email envoyé après le paiement. La page du dossier demande `no-referrer` pour que ce lien ne parte pas vers un autre site. Un lien au mauvais format produit la même réponse 404 qu’un lien inconnu.

## Contrat des routes

Les écritures venant du navigateur contrôlent l’origine. Les réponses JSON et les exports sont servis avec `Cache-Control: private, no-store`.

| Route | Entrée | Sortie |
|---|---|---|
| `POST /api/checkout` | `{answers}` | `{url}` |
| `GET /api/dossiers/[lien]` | — | `{dossier,content?}` |
| `POST /api/generate` | `{token}` | `{ok:true}` |
| `PATCH /api/dossiers/[lien]/taches/[id]` | `{done}` | `{ok:true}` |
| `GET /api/dossiers/[lien]/export` | — | Prompt Markdown téléchargé |
| `POST /api/remboursement` | `{token}` | `{ok:true,status}` |
| `POST /api/webhooks/stripe` | Corps Stripe brut + signature | `{received:true}` |
| `GET` ou `POST /api/internal/retry-emails` | `Authorization: Bearer CRON_SECRET` | `{sent,failed}` |

`POST /api/checkout` est limité à dix demandes par adresse IP sur dix minutes, par instance. Le contenu du dossier (sélections, prompt, tâches) n’est renvoyé que si le dossier est prêt, payé et non remboursé.

Avant d’utiliser une clé Stripe de production, renseigner aussi LEGAL_COMPANY_NAME, LEGAL_COMPANY_ADDRESS, LEGAL_COMPANY_REGISTRATION et NEXT_PUBLIC_CONTACT_EMAIL. Checkout vérifie ces champs en mode live. Les pages légales restent à compléter et vérifier pour l’éditeur réel.

Les erreurs suivent `{error,code?}`.

## Génération

La génération ne commence qu’après paiement. `reserve_generation` refuse un dossier non payé ou remboursé, verrouille le dossier et renvoie un instantané des réponses ; la contrainte `dossiers_generation_after_payment` empêche aussi tout passage en génération d’un dossier impayé. Le serveur valide l’instantané avant l’appel à Anthropic.

Le webhook de paiement lance la rédaction après avoir répondu à Stripe, avec `after()` de Next.js. La page du dossier interroge l’état toutes les trois secondes et appelle `POST /api/generate` quand un dossier payé n’est pas en préparation, après un échec, ou quand une préparation dépasse quatre minutes. Un conflit 409 signifie qu’une préparation est déjà en cours.

Chaque dossier a droit à trois tentatives. La route dispose de 180 secondes ; le numéro de tentative empêche un ancien résultat de remplacer une tentative plus récente. `publish_generation` insère les trois sélections, le prompt de 700–900 mots et les quatre semaines de cinq à sept tâches dans une même transaction, puis rend le dossier prêt. Aucun prompt partiel n’est publié. Après trois échecs, la page propose le remboursement et le contact.

La sélection des candidats est déterministe (`src/lib/matching`). Quand moins de trois idées respectent les compétences, le temps et la zone, les plus proches complètent la liste ; les consignes de génération demandent d’adapter le périmètre sans signaler cet écart.

## Stripe

Le prix est fixé exclusivement par le serveur : 3 900 centimes, EUR, Checkout `mode=payment`. Chaque passage en caisse crée un nouveau dossier, avec une clé d’idempotence liée à son paiement. Checkout revient vers `/dossier/[lien]` après paiement et vers `/debloquer?paiement=annule` après annulation.

Abonner le webhook aux événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.created`, `refund.updated` et `refund.failed`. En local, utiliser `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, puis copier son secret `whsec_…` dans `.env.local`. Les clés et webhooks de test et production sont séparés.

Le webhook vérifie la signature du corps brut et relit l’état actuel de la session. Il rapproche le paiement enregistré, ses métadonnées, la devise et les 39 €, puis enregistre l’email saisi dans Checkout. Un événement de Checkout impayé ne donne aucun accès. Les remboursements sont cumulés uniquement lorsque leur statut Stripe est `succeeded`.

`apply_stripe_event` déduplique les événements et modifie le paiement, le droit d’accès et le journal d’email dans une transaction. Un succès arrivé après un remboursement ne réactive pas l’accès.

Le endpoint de remboursement soumet un remboursement intégral Stripe idempotent pour un paiement de moins de 48 heures, identifié par le lien du dossier. Le navigateur ne peut définir aucun montant. Le statut retourné peut être `pending` ; l’accès n’est fermé qu’après confirmation du remboursement par webhook. Les téléchargements déjà effectués ne peuvent pas être révoqués.

## Emails et exploitation

Les emails sont envoyés après la transaction de paiement : « Votre dossier est en préparation », avec le lien personnel du dossier, puis la confirmation d’un éventuel remboursement. Une panne Resend ne retire jamais un droit payé. Le journal d’événements conserve une réservation de deux minutes, le nombre d’essais (huit maximum) et la date d’envoi ; une clé d’idempotence stable est aussi transmise à Resend.

Appeler la route interne de reprise régulièrement avec `CRON_SECRET` ou la configurer comme Vercel Cron. Un secret absent ne permet aucun accès. Les événements épuisant leurs huit essais restent consultables côté administration Supabase. L’idempotence Resend expire après 24 heures : une panne rare après envoi et avant enregistrement SQL peut produire un email répété lors d’une reprise plus tardive ; elle n’affecte pas le paiement. [Documentation Resend](https://resend.com/docs/dashboard/emails/idempotency-keys)

Les clés service-role, Stripe, Resend et Anthropic restent côté serveur. Les fonctions SQL privilégiées ont explicitement perdu le droit `EXECUTE` public et ne sont appelables que par `service_role`.

## Vérification

Avec une base locale migrée, exécuter `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql`. Le test vérifie l’absence d’accès navigateur, la création du dossier au passage en caisse, le refus de générer avant paiement, les webhooks répétés, l’email avec le lien du dossier et le remboursement. Il se termine par `ROLLBACK`.

Les essais réels d’Anthropic, de Checkout, des webhooks et de Resend nécessitent les comptes de test des fournisseurs. Aucune clé ou infrastructure réelle n’est incluse dans ce dépôt.
