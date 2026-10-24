# Revue de sécurité des Hauts faits : confidentialité et intégrité des distinctions

- Date : 2026-10-24
- Périmètre : API du module Hauts faits (`/api/achievements`), projection `achievements`, canal
  temps réel `achievements-<joueur>`, notifications, contributeur de données personnelles,
  modification de `ChannelSource`.
- Références : OWASP Top 10 (A01 Broken Access Control, A04 Insecure Design), RGPD (minimisation).

| N° | Exigence | Vérification | Constat | Statut |
| --- | --- | --- | --- | --- |
| H1 | La route du module est réservée aux joueurs connectés | Test « refuse la route et le canal à une requête anonyme (401) » | 401 sans session, sur la route et sur le canal | Conforme |
| H2 | Un joueur ne consulte que ses propres hauts faits | Lecture de `api.ts` : aucun paramètre ; test « règle 7 : ne présente à un joueur que ses propres hauts faits » | Le joueur est toujours `c.var.userId` | Conforme |
| H3 | Un joueur ne peut pas écouter le canal d'un autre joueur | Test « règle 7 : refuse à un joueur le canal des hauts faits d'un autre joueur (403) » | `canSubscribe` n'accepte que `achievements-<son identifiant>` | Conforme |
| H4 | Un joueur ne peut pas s'attribuer un haut fait | Lecture de `api.ts` : aucune route d'écriture ; `git grep -n "insert(unlocked" -- src` | Seule la projection écrit dans `unlocked`, à partir des événements du journal | Conforme |
| H5 | Un haut fait n'est attribué qu'une fois, et jamais retiré | Index unique `(player_id, achievement)` ; tests des règles 4 et 6 (projection, dont la reconstruction) | `ON CONFLICT DO NOTHING` ; `reset` exclut `unlocked` | Conforme |
| H6 | Les actions des compagnons ne sont attribuées à aucun joueur | Test « attribue une expédition gagnée et son butin à ses joueurs, sans les compagnons » | Seuls l'hôte et les joueurs ayant rejoint sont enregistrés comme participants | Conforme |
| H7 | Le canal ne transmet que des données destinées au joueur | Route de repli `/api/stream/achievements-<joueur>/events?after=0` | Seuls l'identifiant du haut fait, son libellé et sa date sont transmis | Conforme |
| H8 | La modification de `ChannelSource` ne change le comportement d'aucun autre canal | Tests existants de la Taverne (`tavern-api.test.ts`) et du temps réel (`stream-api.test.ts`) | La source de la Taverne ignore le nouveau paramètre ; les tests réussissent sans changement | Conforme |
| H9 | Les données personnelles du module sont exportées et effacées | Test « inclut les hauts faits dans l'export, et les efface avec le compte » ; `personal-data.test.ts` | Les quatre tables sont couvertes par l'effacement ; l'export rattrape la projection | Conforme |
| H10 | Les lectures du module tiennent le budget de performance | `scripts/load-test.ts` sur la construction de production | `GET /api/achievements` : p99 de 317 ms pour un budget de 500 ms, sans erreur | Conforme |
| H11 | Les abonnés au canal ne peuvent pas saturer la base | Lecture de la source du canal : rattrapage à chaque lecture du flux | Coût proportionnel au nombre de joueurs connectés (DT-015) | Risque accepté |

## Synthèse

11 exigences : 10 conformes, 0 non conforme, 1 en risque accepté (H11).

Action décidée : H11, déclencher le rattrapage une seule fois pour tous les abonnés si le nombre de
joueurs connectés augmente (DT-015) ; mesurer la charge de la base, flux ouverts, avant toute ouverture
plus large.