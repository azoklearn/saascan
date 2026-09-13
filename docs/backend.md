# Backend SaaScan

Le backend utilise Supabase réellement configuré. Il ne fournit aucune authentification, génération, donnée payante ou transaction fictive. Le mode découverte de l’interface reste dans le stockage local du navigateur.

## Configuration

Copier `.env.example` dans `.env.local`, remplir les valeurs, puis redémarrer Next.js. Les variables absentes entraînent une réponse JSON française `503 NOT_CONFIGURED` ; `GET /api/session` permet de détecter l’absence de Supabase sans erreur.

Appliquer dans cet ordre les migrations `202609120001_initial_schema.sql` et `202609120002_server_transactions.sql` depuis Supabase CLI ou le SQL Editor. La seconde ajoute les transactions métier, `dossiers.access_payment_id` pour distinguer un achat d’un paiement en double et un verrou de reprise d’email.

Dans Supabase Auth, activer Email et la confirmation des adresses, désactiver les comptes anonymes et renseigner l’URL de l’application ainsi que les retours `/auth/callback` et `/auth/confirm`. Le flux courant emploie PKCE, avec `{{ .ConfirmationURL }}` dans le modèle d’email ; il faut ouvrir le lien dans le navigateur qui a demandé la connexion. Le endpoint `/auth/confirm` accepte aussi un modèle utilisant `token_hash` et `type=email` pour une confirmation directe.

Pour SMTP Resend dans Supabase : hôte `smtp.resend.com`, port `465`, utilisateur `resend`, mot de passe égal à la clé API Resend, adresse expéditrice du domaine vérifié. Configurer la même adresse dans `RESEND_FROM_EMAIL` pour les emails de dossier et remboursement. Le modèle local se trouve dans `supabase/templates/magic-link.html`.

## Contrat des routes

Les routes privées vérifient la session avec `getUser()`. Les écritures venant du navigateur contrôlent l’origine. Les réponses JSON et les exports privés sont servis avec `Cache-Control: private, no-store`.

| Route | Entrée | Sortie |
|---|---|---|
| `GET /api/session` | — | `{user, configured}` |
| `POST /api/auth/magic-link` | `{email,next?}` | `{ok:true}` |
| `POST /api/dossiers` | — | `{id}` |
| `GET /api/dossiers` | — | `{dossiers}` |
| `GET /api/dossiers/[id]` | — | `{dossier,answers,content?}` |
| `PUT /api/dossiers/[id]/responses` | `{question_id,value}` | `{ok:true}` |
| `POST /api/generate` | `{dossier_id}` | `{ok:true}` |
| `POST /api/checkout` | `{dossier_id}` | `{url}` |
| `PATCH /api/plan-tasks/[id]` | `{done}` | `{ok:true}` |
| `GET /api/dossiers/[id]/export` | — | Prompt Markdown téléchargé |
| `POST /api/remboursement` | `{dossier_id,reason?}` | `{ok:true,status}` |
| `POST /api/webhooks/stripe` | Corps Stripe brut + signature | `{received:true}` |
| `GET` ou `POST /api/internal/retry-emails` | `Authorization: Bearer CRON_SECRET` | `{sent,failed}` |
| `POST /auth/deconnexion` | — | `{ok:true}` |

Avant d’utiliser une clé Stripe de production, renseigner aussi LEGAL_COMPANY_NAME, LEGAL_COMPANY_ADDRESS, LEGAL_COMPANY_REGISTRATION et NEXT_PUBLIC_CONTACT_EMAIL. Checkout vérifie ces champs en mode live. Les pages légales restent à compléter et vérifier pour l’éditeur réel.

Les erreurs suivent `{error,code?}`. Un dossier introuvable et celui d’un autre compte produisent le même résultat. Les sélections, le prompt et les tâches ne sont lus qu’avec la session utilisateur et leurs politiques RLS. Retirer le flou du paywall ne révèle aucun texte réel.

## Génération

La validation de chaque réponse a lieu avant sa sauvegarde. La RPC `save_response` verrouille le dossier et autorise l’écriture pendant le brouillon ou après un échec, qui redevient alors un brouillon. `reserve_generation` vérifie le propriétaire, verrouille également le profil pour sérialiser les quotas et renvoie un instantané des vingt réponses. Le serveur valide cet instantané avant l’appel à Anthropic.

Le maximum est de trois tentatives par dossier. Le quota des dernières 24 heures est volontairement conservateur : il additionne les tentatives des dossiers dont la dernière génération est récente, plafonné à dix. Une génération active expire après quatre minutes. La route dispose de 180 secondes ; après interruption, une relance peut réserver une nouvelle tentative. Son numéro empêche un ancien résultat de remplacer une nouvelle tentative.

`publish_generation` insère les trois sélections, le prompt de 700–900 mots et les quatre semaines de cinq à sept tâches dans une même transaction, puis rend le dossier prêt. Si moins de trois idées respectent les contraintes, le brouillon redevient modifiable. Les autres échecs permettent une relance dans la limite du quota. Aucun prompt partiel n’est publié.

## Stripe

Le prix est fixé exclusivement par le serveur : 3 900 centimes, EUR, Checkout `mode=payment`. Une tentative de paiement possède sa propre clé d’idempotence. Une session ouverte est réutilisée ; une session expirée est remplacée. Le retour Checkout affiche `/debloquer/[id]?payment=success` et attend la confirmation en base.

Abonner le webhook aux événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.created`, `refund.updated` et `refund.failed`. En local, utiliser `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, puis copier son secret `whsec_…` dans `.env.local`. Les clés et webhooks de test et production sont séparés.

Le webhook vérifie la signature du corps brut et relit l’état actuel de la session. Il rapproche le paiement enregistré, ses métadonnées, le propriétaire, la devise et les 39 €. Un événement de Checkout impayé ne donne aucun accès. Les remboursements sont cumulés uniquement lorsque leur statut Stripe est `succeeded`.

`apply_stripe_event` déduplique les événements et modifie le paiement, le droit d’accès et le journal d’email dans une transaction. Un succès arrivé après un remboursement ne réactive pas l’accès. Le paiement qui a initialement ouvert le dossier est référencé explicitement : rembourser un éventuel paiement en double ne ferme pas cet achat initial.

Le endpoint de remboursement soumet un remboursement intégral Stripe idempotent pour un paiement du compte connecté datant de moins de 14 jours. Le navigateur ne peut définir aucun montant. Le statut retourné peut être `pending` ; l’accès n’est fermé qu’après confirmation du remboursement par webhook. Les téléchargements déjà effectués ne peuvent pas être révoqués.

## Emails et exploitation

Les emails sont envoyés après la transaction de paiement. Une panne Resend ne retire jamais un droit payé. Le journal d’événements conserve une réservation de deux minutes, le nombre d’essais (huit maximum) et la date d’envoi ; une clé d’idempotence stable est aussi transmise à Resend.

Appeler la route interne de reprise régulièrement avec `CRON_SECRET` ou la configurer comme Vercel Cron. Un secret absent ne permet aucun accès. Les événements épuisant leurs huit essais restent consultables côté administration Supabase. L’idempotence Resend expire après 24 heures : une panne rare après envoi et avant enregistrement SQL peut produire un email répété lors d’une reprise plus tardive ; elle n’affecte pas le paiement. [Documentation Resend](https://resend.com/docs/dashboard/emails/idempotency-keys)

La limitation des demandes de magic link ajoute une protection par instance aux quotas natifs de Supabase Auth ; elle ne remplace pas les paramètres Auth de limitation et protection antibot de production. Les quotas de génération, eux, sont persistants en PostgreSQL.

Les clés service-role, Stripe, Resend et Anthropic restent côté serveur. Les noms de fonction SQL privilégiés ont explicitement perdu le droit `EXECUTE` public et ne sont appelables que par `service_role`.

## Vérification

Avec une base locale migrée, exécuter `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql`. Le test vérifie deux comptes isolés, les contenus verrouillés avant paiement, les colonnes sensibles, les tâches cochables, les webhooks répétés et le refus d’accès après remboursement. Il se termine par `ROLLBACK` et ne conserve pas ses comptes de test.

Les essais réels du lien email, d’Anthropic, de Checkout et des webhooks nécessitent les comptes de test des fournisseurs. Aucune clé ou infrastructure réelle n’est incluse dans ce dépôt.
