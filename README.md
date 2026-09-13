# SaaScan

Application française qui transforme neuf réponses en trois pistes de SaaS, un prompt de construction et un plan sur 30 jours. Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase, Anthropic, Stripe Checkout et Resend.

## Démarrer localement

Node.js 22.12+ recommandé (développement et tests vérifiés avec Node 24).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Ouvrir [localhost:3000](http://localhost:3000). Sans clés, la landing, le questionnaire, l’animation de calcul et l’offre fonctionnent ; le bouton de paiement indique que le service doit être configuré et propose le dossier de démonstration.

Pour parcourir tout le parcours sans paiement : [questionnaire de démonstration](http://localhost:3000/questionnaire?demo=1), puis « Ouvrir le dossier de démonstration » sur l’offre. Le [dossier d’exemple](http://localhost:3000/dossier/demo?demo=1) s’ouvre aussi directement. La démo est explicitement signalée, utilise du contenu déterministe et le stockage local du navigateur : elle n’appelle pas l’IA, n’écrit rien en base et ne demande aucune carte.

## Le parcours

1. « Créer mon SaaS » mène directement au questionnaire, sans compte : deux écrans d’introduction, puis neuf questions (tranche d’âge, cible B2B ou B2C, domaines, compétences, temps par jour, zone, facturation, concurrence et objectif de revenu au curseur). Les réponses restent dans le navigateur ; des pastilles permettent de revenir sur une réponse.
2. Une animation de calcul mène à l’écran « Prêt », puis à l’offre à 39 €.
3. Au paiement, le serveur valide les réponses, crée le dossier avec un lien d’accès secret et ouvre Stripe Checkout, qui demande l’email.
4. Le webhook confirme le paiement, envoie le lien du dossier par email et lance la rédaction. La page `/dossier/<lien>` suit la préparation et la relance si nécessaire. La base de données refuse toute génération avant la confirmation du paiement.

## Ce qui est inclus

- Landing, FAQ accessible, navigation mobile et thème sombre turquoise.
- Questionnaire sans compte, avec reprise automatique et un curseur de revenu utilisable au doigt.
- Banque de vingt idées françaises écrites à la main dans `data/ideas.json` ; domaines, canaux et périmètres dans `src/lib/matching/idea-rules.ts`.
- Sélection déterministe : les idées compatibles avec les compétences, le temps et la zone passent en premier, classées selon les domaines, la cible, la facturation, la concurrence et l’objectif. Quand moins de trois idées conviennent, les plus proches complètent la sélection et le dossier les adapte sans le signaler.
- Génération Anthropic après paiement : sortie structurée, trois idées distinctes, citations vérifiées des neuf réponses, prompt de 700 à 900 mots et cinq à sept tâches par semaine.
- Stripe Checkout à 39 € par dossier, webhook signé et idempotent, remboursement sous 48 heures depuis le dossier.
- Dossier accessible par lien personnel : trois idées, copie et export `.md` du prompt, plan à cocher.
- Resend après confirmation de paiement, journal d’envoi et reprise des erreurs.
- Trois migrations PostgreSQL : RLS sur toutes les tables, aucun droit pour les rôles du navigateur, transactions réservées au serveur.
- Pages de contact, garantie, confidentialité, mentions légales et CGV configurables. Les textes légaux sont une base préparatoire à adapter au vendeur réel avant commercialisation.

## Configurer Supabase

1. Créer un projet Supabase, de préférence dans une région adaptée à l’exploitation du service.
2. Renseigner `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. La clé `service_role` reste exclusivement côté serveur.
3. Appliquer les migrations dans cet ordre, dans le SQL Editor ou avec Supabase CLI :
   - `supabase/migrations/202609120001_initial_schema.sql`
   - `supabase/migrations/202609120002_server_transactions.sql`
   - `supabase/migrations/202609130001_parcours_sans_compte.sql`
4. Supabase Auth n’est pas utilisé : aucune connexion ni inscription n’est nécessaire.

La troisième migration fonctionne aussi sur une base qui a déjà reçu les deux premières : elle conserve l’historique éventuel, retire tous les droits des rôles `anon` et `authenticated`, ajoute le lien d’accès et l’email de l’acheteur, et impose la génération après paiement. Les tables de paiement utilisent des clés `ON DELETE RESTRICT` afin de ne pas effacer l’historique de paiement par cascade.

## Configurer Anthropic

Renseigner `ANTHROPIC_API_KEY`. Le modèle demandé est configurable avec `ANTHROPIC_MODEL=claude-sonnet-4-5` ; vérifier sa disponibilité pour le compte utilisé. L’intégration utilise `output_config.format`, le helper Zod du SDK, puis une seconde validation métier locale. Zod 4 est nécessaire à la version du SDK installée.

Le modèle reçoit les réponses et les candidats, sans email ni lien d’accès. Une réponse tronquée, un modèle indisponible ou un dossier invalide produit un état d’échec, jamais un faux résultat.

La rédaction démarre après la confirmation du paiement, depuis le webhook puis depuis la page du dossier si nécessaire. Une tentative dispose de 180 secondes et la réservation expire après quatre minutes. Un dossier payé a droit à trois tentatives ; après trois échecs, la page propose le remboursement et le contact.

## Configurer Stripe

1. Commencer avec `STRIPE_SECRET_KEY=sk_test_…`.
2. Le produit et son prix sont créés directement dans les paramètres Checkout : 3 900 centimes EUR, `mode: payment`. Aucun Price ID n’est nécessaire.
3. Créer un webhook vers `/api/webhooks/stripe`, puis renseigner `STRIPE_WEBHOOK_SECRET`.
4. Événements attendus : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed`.
5. En local, avec Stripe CLI :

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Le secret affiché par Stripe CLI est celui du webhook local. Il diffère du secret de production. Tester un paiement avec les moyens de test fournis par Stripe, puis vérifier la préparation du dossier, un webhook répété et un remboursement.

Après paiement, Checkout renvoie vers `/dossier/<lien>` ; une annulation revient sur l’offre. Le retour navigateur ne débloque rien : seule la confirmation serveur le fait. La signature, le montant, la devise, le dossier et les références de paiement sont vérifiés. Les remboursements confirmés sont cumulés de manière monotone. Un ancien événement de paiement ne réouvre pas un dossier remboursé.

Avant une clé `sk_live_…`, compléter l’identité du vendeur, les CGV, les informations de médiation et l’email de contact. Checkout exige en mode live `LEGAL_COMPANY_NAME`, `LEGAL_COMPANY_ADDRESS`, `LEGAL_COMPANY_REGISTRATION` et `NEXT_PUBLIC_CONTACT_EMAIL`. Ce contrôle de présence ne remplace pas la vérification des textes applicables à l’activité.

## Configurer Resend

Vérifier un domaine expéditeur et renseigner `RESEND_API_KEY` et `RESEND_FROM_EMAIL`. L’email envoyé après le paiement contient le lien personnel du dossier : c’est le moyen de le retrouver depuis un autre appareil.

Les emails de dossier et de remboursement sont envoyés après la transaction. Un échec email n’annule pas le paiement. Pour reprendre les envois, appeler `GET /api/internal/retry-emails` avec l’en-tête `Authorization: Bearer <CRON_SECRET>`. La configuration Vercel fournie prévoit une reprise quotidienne ; une fréquence plus élevée peut être configurée selon le plan d’hébergement. Les clés d’idempotence Resend ont une fenêtre de 24 heures : voir les limites détaillées dans `docs/backend.md`.

## Déployer sur Vercel

1. Importer le dépôt dans Vercel en tant que projet Next.js.
2. Garder `npm run build` et la sortie Next.js par défaut ; choisir Node 22 ou 24 selon les versions proposées.
3. Ajouter les variables de `.env.example` dans l’environnement souhaité. Renseigner `NEXT_PUBLIC_APP_URL` avec l’URL HTTPS finale. Les variables `NEXT_PUBLIC_*` sont fixées lors du build : redéployer après leur modification.
4. Appliquer les migrations à la base de cet environnement, puis configurer Stripe et Resend avec les URLs finales.
5. Créer une valeur aléatoire longue pour `CRON_SECRET` et vérifier l’accès au job de reprise des emails.
6. Vérifier que le plan Vercel autorise 180 secondes pour `/api/generate` et pour `/api/webhooks/stripe`, qui poursuit la rédaction après avoir répondu à Stripe.
7. Faire le parcours complet en mode test : paiement, préparation, email, tâche cochée et remboursement. Passer Stripe en mode réel seulement après cette vérification et la finalisation des informations commerciales.

Les environnements preview et production doivent utiliser des bases et clés cohérentes. Ne jamais donner des clés de production à un déploiement de démonstration non maîtrisé.

## Vérifications

```bash
npm run typecheck
npm test
npm run build
npm audit
```

Les tests de domaine couvrent les réponses invalides, la sélection des idées (y compris quand aucune ne convient), la longueur du prompt, la structure du plan, les citations et les canaux. Le test de base démarre PostgreSQL avec PGlite, applique les vraies migrations et exécute `supabase/tests/rls.sql` : absence d’accès navigateur, dossier créé au paiement, génération refusée avant paiement, webhooks dupliqués ou tardifs et remboursement. Il ne remplace pas un essai de Stripe, Resend ou Anthropic avec leurs véritables services.

Le protocole de vérification du navigateur est décrit dans `docs/verification.md`.

Le sous-paquet PostCSS de Next.js 15 est remplacé par une version corrigée via `overrides` dans `package.json`. Le build et les tests doivent être relancés si cet override ou Next.js évoluent.

## Adapter la marque

Le nom commercial est **SaaScan**. `src/config/brand.ts` centralise nom, description, URL, couleur et identité du vendeur ; `public/brand/icon.svg` contient l’icône. Pour changer la couleur, modifier aussi les variables `--accent` de `src/app/globals.css`, `--ws-accent` de `src/components/workspace/workspace.css` et `--scan-accent` de `src/components/workspace/scan-flow.css`. Il s’agit d’un déploiement par marque, pas d’un SaaS multi-entreprises.

`data/ideas.json` reste la source éditoriale des idées. Lors d’une modification, adapter les domaines, canaux et périmètres dans `src/lib/matching/idea-rules.ts`, puis relancer les tests. Chaque sélection conserve une copie de son idée pour préserver les anciens dossiers.

## Documentation de référence

- [Sorties structurées Anthropic](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Confirmation Checkout Stripe](https://docs.stripe.com/checkout/fulfillment)
- [Idempotence Resend](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Informations sur la vente à distance](https://www.service-public.fr/particuliers/vosdroits/F10488)
