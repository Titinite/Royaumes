# Rendu de l'évaluation

- Auteur : Thibault LERAY
- Modules : `quests` (Quêtes) et `achievements` (Hauts faits)
- Adresse du déploiement : https://royaumes-three.vercel.app/
- Fiches de cadrage : [fiche-cadrage-quests.md](fiche-cadrage-quests.md) ;
  [fiche-cadrage-achievements.md](fiche-cadrage-achievements.md)

## Exigences minimales - module `quests`

| N° | Fichiers principaux | Tests qui la vérifient |
| --- | --- | --- |
| E1 | `src/modules/quests/` : `domain/`, `application/`, `infrastructure/`, `api.ts`, `index.ts`, `contracts.ts`, `ui.tsx` | `pnpm lint:archi` (règles `module-encapsulation`, `pure-domain`, `application-ignores-infrastructure`, `client-without-server-code`) |
| E2 | `src/bootstrap/create-api.ts`, `app/(jeu)/quests/page.tsx`, `src/ui/app-shell.tsx` | `src/bootstrap/quests-api.test.ts` (application complète assemblée par `createApi`) |
| E3 | `src/modules/quests/domain/catalog.ts`, `domain/daily.ts` | `domain/daily.test.ts` : un `describe` par règle (1, 2, 3, 5, 6 à 8, 9) ; règle 4 : `infrastructure/quests-projection.test.ts` |
| E4 | `src/modules/quests/infrastructure/schema.ts` (schéma `quests`), `drizzle/0013_quests.sql` | `src/bootstrap/architecture.test.ts` (tables rangées dans le schéma du module) ; `personal-data.test.ts` |
| E5 | `src/bootstrap/create-api.ts` (`requireUser` sur `/quests` et `/quests/*`), `api.ts`, `contracts.ts` (`ClaimParams`), `src/platform/http/validate.ts` (`validateParam`) | `quests-api.test.ts` : « refuse toutes les routes à une requête anonyme (401) », « présente les quatre quêtes du jour du joueur connecté… », « refuse un rang de quête invalide (400) » |
| E6 | `infrastructure/quests-projection.ts` (langage publié du Village, du Donjon et du Marché), `application/quests-service.ts` (`realm.deposit`), `src/platform/outbox/outbox.ts` (`enqueue`), `src/modules/tavern/ui.tsx` | `quests-projection.test.ts` ; `quests-service.test.ts` (message, doublon, simultanéité) ; `quests-api.test.ts` « verse la récompense au village du joueur, une seule fois » ; `outbox.test.ts` (`enqueue`) |
| E7 | `src/modules/quests/personal-data.ts`, ajouté à `createPrivacyService` | `personal-data.test.ts` ; `quests-api.test.ts` « inclut les quêtes dans l'export, et les efface avec le compte » |
| E8 | Toutes les règles et routes ci-dessus | Règles 1 à 9 : `daily.test.ts`, `quests-projection.test.ts`, `quests-service.test.ts` ; routes `GET /`, `GET /champions`, `POST /:slot/claim`, tâche quotidienne : `quests-api.test.ts` |
| E9 | `.dependency-cruiser.cjs` et `architecture.test.ts` inchangés | `pnpm verify` : 0 violation, fonctions d'aptitude réussies |
| E10 | Migration `0013_quests` appliquée par `vercel-build` | Parcours manuel en production le 28/10/2026 : réussi |

## Exigences minimales - module `achievements`

| N° | Fichiers principaux | Tests qui la vérifient |
| --- | --- | --- |
| E1 | `src/modules/achievements/` : `domain/`, `application/`, `infrastructure/`, `api.ts`, `index.ts`, `contracts.ts`, `ui.tsx` | `pnpm lint:archi` (mêmes règles que pour `quests`) |
| E2 | `src/bootstrap/create-api.ts`, `app/(jeu)/achievements/page.tsx`, `src/ui/app-shell.tsx` (onglet et notifications) | `src/bootstrap/achievements-api.test.ts` (application complète assemblée par `createApi`) |
| E3 | `src/modules/achievements/domain/catalog.ts`, `domain/rules.ts` (`unlockedBy`, `achievementBoard`) | `domain/rules.test.ts` : règles 1, 3, 4, 5 ; règles 2 et 6 : `infrastructure/achievements-projection.test.ts` ; règle 7 : `achievements-api.test.ts` |
| E4 | `src/modules/achievements/infrastructure/schema.ts` (schéma `achievements`), `drizzle/0014_achievements.sql` | `src/bootstrap/architecture.test.ts` ; `personal-data.test.ts` ; `achievements-projection.test.ts` (reconstruction) |
| E5 | `src/bootstrap/create-api.ts` (`requireUser` sur `/achievements` et `/achievements/*`), `api.ts` (aucun paramètre), `index.ts` (`canSubscribe`) | `achievements-api.test.ts` : « refuse la route et le canal à une requête anonyme (401) », « règle 7 : ne présente à un joueur que ses propres hauts faits », « refuse à un joueur le canal des hauts faits d'un autre joueur (403) » |
| E6 | `infrastructure/achievements-projection.ts` (langage publié du Village, du Donjon et du Marché) | `achievements-projection.test.ts` (Village, Donjon, Marché) ; `achievements-api.test.ts` « débloque « Premier pas » à la fondation du village » |
| E7 | `src/modules/achievements/personal-data.ts`, ajouté à `createPrivacyService` | `personal-data.test.ts` ; `achievements-api.test.ts` « inclut les hauts faits dans l'export, et les efface avec le compte » |
| E8 | Toutes les règles et routes ci-dessus | Règles 1 à 7 : `rules.test.ts`, `achievements-projection.test.ts`, `achievements-api.test.ts` ; route `GET /` et canal `achievements-<joueur>` : `achievements-api.test.ts` |
| E9 | `.dependency-cruiser.cjs` et `architecture.test.ts` inchangés | `pnpm verify` : 0 violation, fonctions d'aptitude réussies |
| E10 | Migration `0014_achievements` appliquée par `vercel-build` | Parcours manuel en production : <à compléter, date> |

## Bonus revendiqués

| N° | Module | Description | Fichiers | Tests | Documentation |
| --- | --- | --- | --- | --- | --- |
| B1 | `achievements` | Canal temps réel propre au module, `achievements-<joueur>`, réservé à son propriétaire, et notifications sur toutes les pages | `src/modules/achievements/index.ts` (`channelPolicy`), `ui.tsx` (`AchievementToasts`), `src/platform/realtime/channel-policy.ts`, `stream-api.ts`, `src/ui/app-shell.tsx` | `achievements-api.test.ts` : « annonce un haut fait débloqué sur le canal du joueur… », « refuse à un joueur le canal des hauts faits d'un autre joueur (403) », « refuse la route et le canal à une requête anonyme (401) » | ADR 12 ; README (Temps réel) ; `docs/architecture.md` |
| B2 | `quests` | Tâche quotidienne propre au module : suppression de la progression et des réclamations de plus de 7 jours | `domain/daily.ts` (`firstKeptDay`), `application/quests-service.ts` (`purge`), `infrastructure/drizzle-quest-repository.ts` (`removeBefore`), `create-api.ts` | `daily.test.ts` « conserve les données des sept derniers jours… » ; `quests-api.test.ts` « supprime les données de plus de sept jours… » | ADR 10 ; README (Données personnelles) ; registre des traitements (T8) |
| B4 | `quests` et `achievements` | Modèles de lecture tenus par les projections `quests` et `achievements`, avec leur point de reprise et leur version | `quests/infrastructure/quests-projection.ts`, `achievements/infrastructure/achievements-projection.ts`, et leurs adaptateurs (rattrapage à la lecture) | `quests-projection.test.ts` (dont « reconstruit les métriques sans effacer les récompenses réclamées ») ; `achievements-projection.test.ts` (dont « conserve sa date lors d'une reconstruction ») | ADR 11, ADR 12 ; `docs/architecture.md` |
| B6 | `quests` | Communication avec quatre modules existants : Village (langage publié et `realm.deposit`), Donjon et Marché (langage publié), Taverne (badge) | `quests-projection.ts`, `quests-service.ts`, `src/modules/tavern/ui.tsx`, `quests/ui.tsx` (`useChampions`) | `quests-projection.test.ts` (sections Village, Donjon, Marché) ; `quests-api.test.ts` (versement effectif au Village) ; `quests-service.test.ts` (règle 9, champions) | ADR 11 ; `docs/architecture.md` (diagramme de séquence) |
| B7 | `quests` et `achievements` | Test de charge des lectures des deux modules, dans le budget de performance | `scripts/load-test.ts` (scénarios Quêtes, Champions des quêtes, Hauts faits), `perf/eval.json`, `perf/budget.json` | `pnpm exec tsx scripts/load-test.ts eval` : budget respecté (p99 maximal 317 ms < 500 ms, 0 erreur) | ADR 12 ; README (Performance) ; bilan technique |

## Écarts avec les fiches de cadrage

### Module `quests`

- Règles et routes : aucun écart.
- Datation des actions : la fiche ne la précisait pas. Une action est comptée pour le jour de sa
  date `at`, fixée par le module qui la publie (ADR 11).
- Bonus : B8 (fonction d'aptitude) et B10 (Playwright), envisagés dans la fiche, ne sont pas réalisés.
  B1, envisagé, n'est pas réalisé pour ce module ; il l'est pour `achievements`.
- Modifications de l'existant non annoncées dans la fiche : fonctions `enqueue` (boîte d'envoi) et
  `validateParam` (validation des paramètres de chemin), ajoutées à la plateforme et testées (ADR 11).

### Module `achievements`

- Règles et routes : aucun écart.
- Stockage : deux tables de travail de la projection (`game_players`, `offer_buyers`) s'ajoutent
  aux tables annoncées (`counters`, `unlocked`).
- Bonus : B10 (Playwright), envisagé dans la fiche, n'est pas réalisé.
- Modification de l'existant non annoncée dans la fiche : la plateforme transmet le nom du canal à
  la source d'un module (`ChannelSource.read(after, channel)`), modification rétrocompatible et
  testée (ADR 12).

## Évolution hors modules : Festin du Village

Cette évolution du module existant `realm` ne fait partie d'aucun des deux modules évalués. Elle
n'est revendiquée ni comme exigence, ni comme bonus : elle est décrite ici pour que toute
modification du dépôt soit tracée.

| Élément | Fichiers principaux | Tests qui le vérifient | Documentation |
| --- | --- | --- | --- |
| Règle : 300 blés, +25 % de production pendant 5 minutes, un seul festin à la fois | `src/modules/realm/domain/catalog.ts` (`FEAST`), `domain/village.ts` (`HoldFeast`, `FeastHeld`, `produce`, `feastAt`) | `domain/village.test.ts`, section « Village - festin » (9 tests, dont la fin d'un festin au milieu d'un intervalle) | ADR 13 |
| Concurrence : deux festins demandés en même temps | `application/village-service.ts` (inchangé, `withOptimisticRetry`) | `application/village-service.test.ts` « n'accepte qu'un festin lorsque deux sont demandés en même temps » | ADR 13 |
| Route `POST /api/realm/village/feast` (409 si un festin est en cours, 422 sans assez de blé) | `src/modules/realm/api.ts` | `src/bootstrap/realm-api.test.ts`, « Festin du Village », exécuté dans l'application et dans le service extrait | ADR 13 ; ADR 09 |
| Interface : hôtel de ville cliquable, bandeau du festin, décor de la scène | `src/modules/realm/ui.tsx`, `village-scene.tsx`, `app/globals.css` | Vérification manuelle (ordinateur, mobile, thème sombre) | README (Limites actuelles) |

Aucun autre module n'est modifié : le Classement, les Quêtes et les Hauts faits ne lisent pas
l'événement `FeastHeld`.

## Évolutions de l'interface

Ces évolutions ne modifient aucune règle du jeu ni aucune donnée enregistrée. Elles sont tracées
ici, sans être revendiquées comme exigences ou comme bonus.

| Évolution | Fichiers principaux | Vérification | Documentation |
| --- | --- | --- | --- |
| Refonte graphique du Village (scène illustrée, plaques de niveau, caméra et plan d'architecte) et du Donjon (arène, cartes d'action, rejeu de la manche) | `src/modules/realm/village-scene.tsx`, `src/modules/realm/ui.tsx`, `src/modules/dungeon/arena.tsx`, `src/ui/game-icon.tsx`, `src/ui/icon-paths.ts` | Manuelle (ordinateur, mobile, thème sombre, animations réduites) | README (Crédits : icônes game-icons.net, CC BY 3.0) |
| Menu latéral repliable, en tiroir sur petit écran | `src/ui/app-shell.tsx`, `app/layout.tsx`, `app/globals.css` | Manuelle (clavier, Échap, mobile, tablette) | - |
| Taverne : bulles, défilement automatique, bouton des nouveaux messages | `src/modules/tavern/ui.tsx` | Manuelle (deux comptes) | - |
| Pastilles du menu (quêtes à réclamer, hauts faits et messages non vus) | `quests/ui.tsx` (`useQuestNotifications`), `achievements/ui.tsx` (`useAchievementNotifications`), `tavern/ui.tsx` (`useTavernNotifications`), `src/ui/device-store.ts`, `src/ui/app-shell.tsx` | Manuelle (deux comptes) ; `pnpm lint:archi` (le cadre n'importe que les entrées publiques `ui.tsx`) | ADR 14 ; `docs/architecture.md` ; README (Temps réel) |

Les pastilles touchent l'interface des deux modules évalués (`quests` et `achievements`), sans
modifier leur domaine, leur API ni leurs tables.

## Indicateurs au rendu

| Indicateur | À l'étiquette `td11-fin` | Au rendu |
| --- | --- | --- |
| Nombre de tests | 232 | 313 |
| Couverture des lignes | 75 % | 66 % |
| Violations des règles d'architecture | 0 | 0 |

La couverture baisse avec les évolutions de l'interface (scènes du Village et du Donjon, menu,
pastilles) : ces composants sont mesurés, mais vérifiés manuellement et non par des tests
automatisés. Le domaine et l'application des modules évalués restent couverts par leurs tests.

## Usage de l'IA générative

- Outil : Claude utilisé en conversation, sans accès en écriture au dépôt.
- Code : propositions des tests unitaires et refactorisation du code manuellement effectuée pour la
  plupart (+ rédaction des commentaires), pour les deux modules.
- Documents : premières rédactions des ADR 10, 11, 12 et 13 des revues de sécurité des deux modules et
  mise à jour du fichier architecture.
- Fiches de cadrage : idée et règles rédigées par moi, complétées et reformulées avec l'assistant.
- Interface (refonte graphique, menu, Taverne, pastilles) : maquettes, code et première rédaction
  de l'ADR 14 proposés par l'assistant ; choix de conception faits par moi.