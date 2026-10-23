# Rendu de l'évaluation

- Auteur : Thibault LERAY
- Module : `quests` (module évalué) ; `achievements` (module complémentaire, voir plus bas)
- Adresse du déploiement : https://royaumes-three.vercel.app/
- Fiche de cadrage : [fiche-cadrage-quests.md](fiche-cadrage-quests.md)

## Exigences minimales

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
| E10 | Migration `0013_quests` appliquée par `vercel-build` | Parcours manuel en production : <à compléter, date> |

## Bonus revendiqués

| N° | Description | Fichiers | Tests | Documentation |
| --- | --- | --- | --- | --- |
| B2 | Tâche quotidienne propre au module : suppression de la progression et des réclamations de plus de 7 jours | `domain/daily.ts` (`firstKeptDay`), `application/quests-service.ts` (`purge`), `infrastructure/drizzle-quest-repository.ts` (`removeBefore`), `create-api.ts` | `daily.test.ts` « conserve les données des sept derniers jours… » ; `quests-api.test.ts` « supprime les données de plus de sept jours… » | ADR 10 ; README (Données personnelles) ; registre des traitements (T8) |
| B4 | Modèle de lecture tenu par la projection `quests`, avec son point de reprise et sa version | `infrastructure/quests-projection.ts`, `drizzle-quest-repository.ts` (rattrapage à la lecture) | `quests-projection.test.ts` (dont « reconstruit les métriques sans effacer les récompenses réclamées ») | ADR 11 ; `docs/architecture.md` |
| B6 | Communication avec quatre modules existants : Village (langage publié et `realm.deposit`), Donjon et Marché (langage publié), Taverne (badge) | `quests-projection.ts`, `quests-service.ts`, `src/modules/tavern/ui.tsx`, `quests/ui.tsx` (`useChampions`) | `quests-projection.test.ts` (sections Village, Donjon, Marché) ; `quests-api.test.ts` (versement effectif au Village) ; `quests-service.test.ts` (règle 9, champions) | ADR 11 ; `docs/architecture.md` (diagramme de séquence) |

## Écarts avec la fiche de cadrage

- Règles et routes : aucun écart
- Datation des actions : la fiche ne la précisait pas. Une action est comptée pour le jour de sa
  date `at`, fixée par le module qui la publie (ADR 11).
- Bonus : B1 (canal temps réel), B8 (fonction d'aptitude) et B10 (Playwright), envisagés dans la
  fiche, ne sont pas réalisés pour ce module.
- Modifications de l'existant non annoncées dans la fiche : fonctions `enqueue` (boîte d'envoi) et
  `validateParam` (validation des paramètres de chemin), ajoutées à la plateforme et testées (ADR 11).

## Indicateurs au rendu

| Indicateur | À l'étiquette `td11-fin` | Au rendu |
| --- | --- | --- |
| Nombre de tests | 232 | 278 |
| Couverture des lignes | 75 % | 75,83 % |
| Violations des règles d'architecture | 0 | 0 |

## Usage de l'IA générative

- Outil : Claude utilisé en conversation, sans accès en écriture au dépôt.
- Code : propoisitons des tests unitaires et refactorisation du code manuellement effectué pour la plupart (+ rédaction des commentaires)
- Documents : premières rédactions des ADR 10 et 11 et mise à jour du fichier architecture
- Fiches de cadrage : idée et règles rédigées par moi, complétées et reformulées avec l'assistant