# SaaScan

Application française qui transforme neuf réponses en trois pistes de SaaS, un prompt de construction et un plan sur 30 jours, vendus en abonnement. Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase et Whop. Aucun dossier n’est écrit par une IA : les textes sont rédigés à l’avance pour chaque idée et assemblés selon les réponses. Aucun email n’est envoyé : le lien personnel du dossier s’affiche après le paiement.

## Démarrer localement

Node.js 22.12+ recommandé (développement et tests vérifiés avec Node 24).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Ouvrir [localhost:3000](http://localhost:3000). Sans clés, la landing, le questionnaire, l’animation de calcul et l’offre fonctionnent ; le bouton de paiement indique que le service doit être configuré et propose le dossier de démonstration.

Pour parcourir tout le parcours sans paiement : [questionnaire de démonstration](http://localhost:3000/questionnaire?demo=1), puis « Ouvrir le dossier de démonstration » sur l’offre. Le [dossier d’exemple](http://localhost:3000/dossier/demo) s’ouvre aussi directement. Il est assemblé par le serveur pour un profil fictif fixe, avec les bonus de la formule 12 mois : les réponses du visiteur ne produisent jamais un dossier gratuit. Seules les tâches cochées restent dans le navigateur ; rien n’est écrit en base et aucune carte n’est demandée.

## Le parcours

1. « Créer mon SaaS » mène directement au questionnaire, sans compte : deux écrans d’introduction, puis neuf questions (tranche d’âge, cible B2B ou B2C, domaines, compétences, temps par jour, zone, facturation, concurrence et objectif de revenu au curseur). Les réponses restent dans le navigateur ; des pastilles permettent de revenir sur une réponse.
2. Une animation de calcul mène à l’écran « Prêt », puis au choix de la formule : 1 mois à 18,99 €, 3 mois à 29,99 € ou 12 mois à 69,99 €, renouvelés automatiquement.
3. Au paiement, le serveur valide les réponses, crée le dossier avec un lien d’accès secret et ouvre la page de paiement Whop, qui demande l’email.
4. Le webhook confirme le paiement et publie le dossier et les bonus de la formule en quelques secondes. Au retour de Whop, `/dossier/<lien>` affiche le dossier, invite à garder le lien et relance la publication si nécessaire. Sur cet appareil, le lien reste accessible depuis le menu « Mon dossier ». La base de données refuse toute publication avant la confirmation du paiement.
5. Le dossier reste accessible tant que l’abonnement est actif. La personne peut le résilier depuis le dossier, demander le remboursement du premier paiement pendant 48 heures, ou réactiver un abonnement terminé depuis le même lien.

## Ce qui est inclus

- Landing, FAQ accessible, navigation mobile et thème sombre turquoise.
- Questionnaire sans compte, avec reprise automatique et un curseur de revenu utilisable au doigt.
- Banque de vingt idées françaises écrites à la main dans `data/ideas.json` ; domaines, canaux et périmètres dans `src/lib/matching/idea-rules.ts`.
- Sélection déterministe : les idées compatibles avec les compétences, le temps et la zone passent en premier, classées selon les domaines, la cible, la facturation, la concurrence et l’objectif. Quand moins de trois idées conviennent, les plus proches complètent la sélection et le dossier les adapte sans le signaler.
- Contenus rédigés à l’avance dans `data/contenus/<idée>.json` : risque, produit, écrans, données et critères du prompt, tâches de construction, 60 idées de vidéos et plan de A à Z en sept phases. `src/lib/dossier/content.ts` les combine avec les neuf réponses : trois idées argumentées qui citent chaque réponse, prompt de 700 à 900 mots adapté aux compétences, au temps, à la zone et à la facturation, plan de six tâches par semaine.
- Bonus selon la formule : 30 idées de vidéos marketing (3 mois), 60 idées et un plan de A à Z sur douze mois (12 mois).
- Offre à trois formules définies dans `src/config/plans.json`. Les prix barrés et les pourcentages comparent au même nombre de mois en formule mensuelle ; aucun faux compte à rebours.
- Abonnements Whop : webhook signé et idempotent, accès lié à l’abonnement, résiliation en fin de période depuis le dossier, remboursement du premier paiement sous 48 heures.
- Dossier accessible par lien personnel : bouton « Copier le lien », lien conservé dans le navigateur derrière « Mon dossier », trois idées, copie et export `.md` du prompt, plan à cocher, vidéos et plan de A à Z selon la formule.
- Six migrations PostgreSQL : RLS sur toutes les tables, aucun droit pour les rôles du navigateur, transactions réservées au serveur.
- Pages de contact, garantie, confidentialité, mentions légales et CGV configurables. Les textes légaux sont une base préparatoire à adapter au vendeur réel avant commercialisation.

## Configurer Supabase

1. Créer un projet Supabase, de préférence dans une région adaptée à l’exploitation du service.
2. Renseigner `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. La clé `service_role` reste exclusivement côté serveur.
3. Appliquer les migrations dans cet ordre, dans le SQL Editor ou avec Supabase CLI :
   - `supabase/migrations/202609120001_initial_schema.sql`
   - `supabase/migrations/202609120002_server_transactions.sql`
   - `supabase/migrations/202609130001_parcours_sans_compte.sql`
   - `supabase/migrations/202609130002_abonnements_whop.sql`
   - `supabase/migrations/202609130003_contenus_rediges.sql`
   - `supabase/migrations/202609130004_sans_emails.sql`
4. Supabase Auth n’est pas utilisé : aucune connexion ni inscription n’est nécessaire.

La troisième migration retire tous les droits des rôles `anon` et `authenticated`, ajoute le lien d’accès et l’email de l’acheteur, et impose la publication après paiement. La quatrième passe aux abonnements : paiements et journal d’événements indépendants du prestataire, formule et état de l’abonnement sur le dossier, tables des vidéos et du plan de A à Z. La cinquième supprime les lots quotidiens de vidéos et accepte 60 idées pour la formule 12 mois. La sixième retire le journal d’envoi et les rappels par email. Les tables de paiement utilisent des clés `ON DELETE RESTRICT` afin de ne pas effacer l’historique de paiement par cascade.

## Modifier les contenus

`data/contenus/SPEC.md` décrit la structure et les règles de rédaction : vouvoiement, apostrophe typographique, aucun chiffre inventé ni promesse de résultat, longueurs de chaque partie. Après une modification :

```bash
npx vitest run tests/contenus.test.ts -t relance-devis-artisans --silent=false --reporter=verbose
```

Le test vérifie chaque fichier, calcule le prompt pour 3 072 profils (700 à 900 mots exigés) et affiche la fourchette obtenue. Une nouvelle idée demande une entrée dans `data/ideas.json`, ses règles dans `idea-rules.ts`, son fichier de contenu et son import dans `src/lib/dossier/library.ts`.

Les dossiers déjà publiés gardent le texte de leur publication : une correction s’applique aux dossiers suivants.

## Configurer Whop

1. Créer une clé API d’entreprise sur Whop et la placer dans `WHOP_API_KEY`.
2. Lancer `node scripts/whop-catalogue.mjs`. Le script crée un produit masqué et les trois formules en euros (renouvellement automatique, sans frais initiaux), puis écrit `WHOP_PRODUCT_ID` et `WHOP_PLAN_MENSUEL`, `WHOP_PLAN_TRIMESTRIEL`, `WHOP_PLAN_ANNUEL` dans `.env.local`. Relancé, il retrouve les formules existantes au lieu de les dupliquer. Il n’affiche jamais la clé.
3. Lancer `node scripts/whop-webhook.mjs https://<domaine>`. Le script crée le webhook vers `/api/webhooks/whop` avec les événements `payment.succeeded`, `membership.activated`, `membership.deactivated`, `membership.cancel_at_period_end_changed`, `refund.created` et `refund.updated`, puis écrit son secret `ws_…` dans `WHOP_WEBHOOK_SECRET` sans l’afficher.
4. Whop exige une adresse de retour HTTPS : le paiement se teste sur le déploiement Vercel, pas sur `http://localhost`.
5. Pour le bac à sable, utiliser une clé du bac à sable avec `WHOP_API_URL=https://sandbox-api.whop.com/api/v1`, relancer les deux scripts, puis payer avec la carte de test `4242 4242 4242 4242`.

Après paiement, Whop renvoie vers `/dossier/<lien>`. Le retour navigateur ne débloque rien : seule la confirmation serveur le fait. Chaque webhook vérifie la signature du corps brut, puis relit chez Whop l’état actuel du paiement et de l’abonnement. Les métadonnées du passage en caisse relient le paiement au dossier ; les renouvellements sont rattachés par l’abonnement. Un ancien événement ne rouvre pas un dossier remboursé et un état d’abonnement plus ancien ne remplace pas un état plus récent.

Le contenu est accessible quand le premier paiement est confirmé, non remboursé, et que l’abonnement est `active`, `trialing`, `past_due` ou `canceling`. Si un webhook manque, la page du dossier relit l’abonnement chez Whop au plus toutes les dix minutes. La résiliation prend effet en fin de période. Une demande de remboursement arrête d’abord le renouvellement, puis rembourse le premier paiement ; l’accès se ferme à la confirmation et l’abonnement est alors annulé.

Sans `WHOP_API_URL`, le client vise la production : le passage en caisse exige aussi `LEGAL_COMPANY_NAME`, `LEGAL_COMPANY_ADDRESS`, `LEGAL_COMPANY_REGISTRATION` et `NEXT_PUBLIC_CONTACT_EMAIL`. Ce contrôle de présence ne remplace pas la vérification des textes applicables à l’activité. SaaScan n’envoie aucun rappel avant le renouvellement des formules 3 et 12 mois : vérifier les obligations d’information du vendeur pour les contrats reconduits tacitement (article L215-1 du Code de la consommation).

## Sans email

SaaScan n’envoie aucun email ; Whop envoie ses propres reçus de paiement. Le dossier affiche son lien avec un bouton de copie, et le navigateur utilisé pour le paiement le garde derrière « Mon dossier » dans le menu du site. L’email saisi sur Whop est enregistré dans `dossiers.email` : pour une personne qui a perdu son lien, retrouver son dossier par cet email dans Supabase, vérifier sa demande, puis lui transmettre `https://<domaine>/dossier/<access_token>`.

## Déployer sur Vercel

1. Importer le dépôt dans Vercel en tant que projet Next.js.
2. Garder `npm run build` et la sortie Next.js par défaut ; choisir Node 22 ou 24 selon les versions proposées.
3. Ajouter les variables de `.env.example` dans l’environnement souhaité. Renseigner `NEXT_PUBLIC_APP_URL` avec l’URL HTTPS finale. Les variables `NEXT_PUBLIC_*` sont fixées lors du build : redéployer après leur modification.
4. Appliquer les migrations à la base de cet environnement, puis créer le webhook Whop avec l’URL finale.
5. Faire le parcours complet dans le bac à sable Whop : paiement, dossier et bonus, lien conservé, tâche cochée, résiliation et remboursement. Passer en production seulement après cette vérification et la finalisation des informations commerciales.

Les environnements preview et production doivent utiliser des bases et clés cohérentes. Ne jamais donner des clés de production à un déploiement de démonstration non maîtrisé.

## Vérifications

```bash
npm run typecheck
npm test
npm run build
npm audit
```

Les tests de domaine couvrent les réponses invalides, la sélection des idées (y compris quand aucune ne convient), l’assemblage du dossier (trois idées, citations des neuf réponses, prompt de 700 à 900 mots, plan de 24 tâches, bonus de chaque formule), les canaux, les prix par jour et les économies affichées. Les tests de contenus contrôlent les vingt fichiers rédigés. Le test de base démarre PostgreSQL avec PGlite, applique les vraies migrations et exécute `supabase/tests/rls.sql` : absence d’accès navigateur et de traces d’emails, dossier créé au paiement, publication refusée avant paiement, bonus de la formule 12 mois, renouvellement, résiliation, webhooks dupliqués ou tardifs, remboursement et réactivation. Il ne remplace pas un essai de Whop avec le véritable service.

Le protocole de vérification du navigateur est décrit dans `docs/verification.md`.

Le sous-paquet PostCSS de Next.js 15 est remplacé par une version corrigée via `overrides` dans `package.json`. Le build et les tests doivent être relancés si cet override ou Next.js évoluent.

## Adapter la marque

Le nom commercial est **SaaScan**. `src/config/brand.ts` centralise nom, description, URL, couleur et identité du vendeur ; `public/brand/icon.svg` contient l’icône. Pour changer la couleur, modifier aussi les variables `--accent` de `src/app/globals.css`, `--ws-accent` de `src/components/workspace/workspace.css` et `--scan-accent` de `src/components/workspace/scan-flow.css`. Il s’agit d’un déploiement par marque, pas d’un SaaS multi-entreprises.

`data/ideas.json` reste la source éditoriale des idées. Chaque sélection conserve une copie de son idée pour préserver les anciens dossiers. Pour changer un prix, modifier `src/config/plans.json`, créer la nouvelle formule sur Whop et mettre à jour la variable `WHOP_PLAN_*` correspondante.

## Documentation de référence

- [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Webhooks Whop](https://docs.whop.com/developer/guides/webhooks)
- [Informations sur la vente à distance](https://www.service-public.fr/particuliers/vosdroits/F10488)
