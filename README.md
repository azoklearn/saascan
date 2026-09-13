# SaaScan

Application française pour passer d’un profil réel à trois pistes de SaaS, un prompt de construction et un plan sur 30 jours. Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase, Anthropic, Stripe Checkout et Resend.

## Démarrer localement

Node.js 22.12+ recommandé (développement et tests vérifiés avec Node 24).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Ouvrir [localhost:3000](http://localhost:3000). Sans clés, la landing et les pages d’information fonctionnent. La connexion explique que le service doit être configuré ; aucun compte n’est créé fictivement.

Pour parcourir l’application immédiatement : [dossier d’exemple](http://localhost:3000/dossier/exemple?demo=1) ou [espace de démonstration](http://localhost:3000/app?demo=1). La démo est explicitement signalée, utilise du contenu déterministe et le stockage local du navigateur. Elle n’appelle pas l’IA, ne demande pas de carte et ne simule jamais un paiement confirmé. Les réponses et cases cochées persistent dans ce navigateur. La démo est accessible en production pour présenter le produit ; elle ne donne aucun accès aux dossiers Supabase.

## Ce qui est inclus

- Landing complète, FAQ accessible, navigation mobile et thème sombre turquoise. Les courbes SVG et la lueur du hero reprennent le décor fourni ; la typographie utilise la police système.
- Connexion Supabase par lien email, deux écrans d’introduction, questionnaire centré de vingt questions avec reprise et pastilles de réponses modifiables. Le fond à courbes, les choix transparents et l’analyse circulaire suivent les captures fournies.
- Banque de vingt idées françaises écrites à la main dans `data/ideas.json`.
- Pré-filtrage déterministe : budget, niveau technique, effort de construction, langue et canaux compatibles. Classement de huit candidats au maximum, sans assouplir les contraintes pour en trouver trois.
- Génération Anthropic avec sortie structurée, trois idées distinctes, citations vérifiées des vingt réponses, prompt de 700 à 900 mots et cinq à sept tâches par semaine.
- État persistant et réservation atomique des générations ; contrôle du numéro de tentative pour éviter les résultats périmés.
- Paywall sans contenu complet dans le HTML, Stripe Checkout à 39 € par dossier, webhook signé et idempotent, remboursement sous 14 jours.
- Dossier avec trois idées, copie et export `.md` du prompt, plan à cocher, espace personnel.
- Resend après confirmation de paiement, journal d’envoi et reprise des erreurs.
- Deux migrations PostgreSQL avec RLS sur toutes les tables, droits de colonnes et transactions réservées au serveur.
- Pages de contact, garantie, confidentialité, mentions légales et CGV configurables. Les textes légaux sont une base préparatoire à adapter au vendeur réel avant commercialisation.

## Configurer Supabase

1. Créer un projet Supabase, de préférence dans une région adaptée à l’exploitation du service.
2. Renseigner `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`. La clé `service_role` reste exclusivement côté serveur.
3. Appliquer les migrations dans cet ordre, dans le SQL Editor ou avec Supabase CLI :
   - `supabase/migrations/202609120001_initial_schema.sql`
   - `supabase/migrations/202609120002_server_transactions.sql`
4. Dans Auth, activer la connexion Email avec confirmation et désactiver l’authentification anonyme. Définir Site URL et les Redirect URLs de l’application : `http://localhost:3000/auth/callback` et `http://localhost:3000/auth/confirm` en développement, puis leurs équivalents sur le domaine de production.
5. Utiliser le modèle `supabase/templates/magic-link.html`. Le parcours utilise PKCE : ouvrir le lien dans le même navigateur que celui qui a demandé la connexion.
6. Configurer les limites d’envoi de Supabase Auth. Le limiteur applicatif des demandes email fonctionne par instance ; il complète les limites persistantes de Supabase.

La première migration cible un projet neuf. Les tables de paiement utilisent des clés `ON DELETE RESTRICT` afin de ne pas effacer l’historique de paiement par cascade. L’effacement d’un compte ayant payé doit être traité côté administration, avec dissociation/conservation des éléments nécessaires selon les obligations du vendeur ; aucune suppression automatique globale n’est exposée.

## Configurer Anthropic

Renseigner `ANTHROPIC_API_KEY`. Le modèle demandé est configurable avec `ANTHROPIC_MODEL=claude-sonnet-4-5` ; vérifier sa disponibilité pour le compte utilisé. L’intégration utilise `output_config.format`, le helper Zod du SDK, puis une seconde validation métier locale. Zod 4 est nécessaire à la version du SDK installée.

Le modèle reçoit les réponses et les candidats, sans email ni identifiant de compte. Les champs libres sont traités comme des données non fiables. Une réponse tronquée, un modèle indisponible ou un dossier invalide produit un état d’échec, jamais un faux résultat de succès.

Une tentative dispose d’un délai de 180 secondes ; la réservation expire après quatre minutes. Trois tentatives par dossier et un quota conservateur de dix tentatives par compte sur les dernières 24 heures limitent les appels. La fermeture du navigateur ne constitue pas une garantie de travail en arrière-plan : le résultat terminé reste en base, et une tentative expirée peut être relancée. Une file de travaux durable pourra être ajoutée si le trafic ou les besoins d’exécution l’exigent.

## Configurer Stripe

1. Commencer avec `STRIPE_SECRET_KEY=sk_test_…`.
2. Le produit et son prix sont créés directement dans les paramètres Checkout : 3 900 centimes EUR, `mode: payment`. Aucun abonnement SaaScan ni Price ID n’est nécessaire.
3. Créer un webhook vers `/api/webhooks/stripe`, puis renseigner `STRIPE_WEBHOOK_SECRET`.
4. Événements attendus : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed`.
5. En local, avec Stripe CLI :

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Le secret affiché par Stripe CLI est celui du webhook local. Il diffère du secret de production. Tester un paiement avec les moyens de test fournis par Stripe, puis confirmer le contenu visible dans le bon compte, un webhook répété et un remboursement. Aucun numéro de carte réel n’est nécessaire pendant ces essais.

Le retour navigateur ne débloque rien : seule la confirmation serveur le fait. La signature, le montant, la devise, l’identité du dossier et les références de paiement sont vérifiés. Les remboursements confirmés sont cumulés de manière monotone. Un ancien événement de paiement ne réouvre pas un dossier remboursé.

Avant une clé `sk_live_…`, compléter l’identité du vendeur, les CGV, les informations de médiation et l’email de contact. Checkout exige en mode live `LEGAL_COMPANY_NAME`, `LEGAL_COMPANY_ADDRESS`, `LEGAL_COMPANY_REGISTRATION` et `NEXT_PUBLIC_CONTACT_EMAIL`. Ce contrôle de présence ne remplace pas la vérification des textes applicables à ton activité.

## Configurer Resend

Vérifier un domaine expéditeur et renseigner `RESEND_API_KEY` et `RESEND_FROM_EMAIL`. Pour les liens Supabase, configurer séparément SMTP dans Supabase Auth : `smtp.resend.com`, port 465, utilisateur `resend`, mot de passe correspondant à la clé API, expéditeur du domaine vérifié.

Les emails de dossier et remboursement sont envoyés après la transaction. Un échec email n’annule pas le paiement. Pour reprendre les envois, appeler `GET /api/internal/retry-emails` avec l’en-tête `Authorization: Bearer <CRON_SECRET>`. La configuration Vercel fournie prévoit une reprise quotidienne ; une fréquence plus élevée peut être configurée selon le plan d’hébergement. Les clés d’idempotence Resend ont une fenêtre de 24 heures : voir les limites détaillées dans `docs/backend.md`.

## Déployer sur Vercel

1. Mettre le projet dans ton dépôt Git et l’importer dans Vercel en tant que projet Next.js.
2. Garder `npm run build` et la sortie Next.js par défaut ; choisir Node 22 ou 24 selon les versions proposées.
3. Ajouter les variables de `.env.example` dans l’environnement souhaité. Renseigner `NEXT_PUBLIC_APP_URL` avec l’URL HTTPS finale. Les variables `NEXT_PUBLIC_*` sont fixées lors du build : redéployer après leur modification.
4. Appliquer les migrations à la base correspondant à cet environnement, configurer Auth, Stripe et Resend avec les URLs finales.
5. Créer une valeur aléatoire longue pour `CRON_SECRET`, et vérifier l’accès au job de reprise des emails.
6. Vérifier que le plan Vercel autorise la durée de 180 secondes de la route de génération et que les timeouts en amont sont compatibles.
7. Faire le parcours complet avec un compte de test, puis vérifier l’isolement avec un second compte. Passer Stripe en mode réel seulement après cette vérification et finalisation des informations commerciales.

Les environnements preview et production doivent utiliser des bases et clés cohérentes. Ne jamais donner des clés de production à un déploiement de démonstration non maîtrisé.

## Vérifications

```bash
npm run typecheck
npm test
npm run build
npm audit
```

Les tests de domaine couvrent les contraintes de faisabilité, les réponses invalides, les trois sélections, la longueur du prompt, la structure du plan et les citations inventées. Le test de base démarre PostgreSQL avec PGlite, simule uniquement les rôles et la table Auth de Supabase, applique les vraies migrations et exécute `supabase/tests/rls.sql`. Il vérifie les accès impayés/payés/remboursés, l’isolement entre comptes, les écritures sensibles et les webhooks dupliqués ou tardifs. Il ne remplace pas un essai de Supabase Auth, Stripe, Resend ou Anthropic avec leurs véritables services.

Un protocole de vérification du navigateur est disponible dans `docs/verification.md`. Il couvre la landing à 390 px, le questionnaire et sa reprise, le dossier, la copie du prompt et la persistance des cases.

Le sous-paquet PostCSS de Next.js 15 est remplacé par une version corrigée via `overrides` dans `package.json`. Le build et les tests doivent être relancés si cet override ou Next.js évoluent.

## Adapter la marque

Le nom commercial est **SaaScan**. `src/config/brand.ts` centralise nom, description, URL, couleur et identité du vendeur ; `public/brand/icon.svg` contient l’icône. Pour changer la couleur, modifier aussi les variables `--accent` de `src/app/globals.css` et `--ws-accent` de `src/components/workspace/workspace.css`. Il s’agit d’un déploiement par marque, pas d’un SaaS multi-entreprises.

`data/ideas.json` reste la source éditoriale des idées. Lors d’une modification, adapter les règles correspondantes dans `src/lib/matching/idea-rules.ts`, actualiser la version de banque et relancer les tests. Chaque sélection conserve une copie de son idée pour préserver les anciens dossiers.

## Documentation de référence

- [Sorties structurées Anthropic](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) et [droits de colonnes](https://supabase.com/docs/guides/database/postgres/column-level-security)
- [Confirmation Checkout Stripe](https://docs.stripe.com/checkout/fulfillment)
- [Idempotence Resend](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Informations sur la vente à distance](https://www.service-public.fr/particuliers/vosdroits/F10488)
