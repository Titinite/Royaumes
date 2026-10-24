# ADR-12 - Module Hauts faits : projection du journal, déblocages permanents, et canal temps réel par joueur

- Statut : accepté
- Date : 2026-10-24

## Contexte

Le module Hauts faits attribue des distinctions permanentes lorsqu'un joueur atteint certains seuils
(fiche de cadrage : `docs/evaluation/fiche-cadrage-achievements.md`). Toutes les grandeurs mesurées
(améliorations, expéditions, butin, offres, achats) se déduisent d'événements déjà présents dans le
journal du Village, du Donjon et du Marché.

Contrairement aux Quêtes (ADR 10), ses données n'expirent pas. Un haut fait obtenu l'est pour
toujours (R4), et sa date d'obtention est celle de l'action qui l'a débloqué, même après un
recalcul (R6).

Le joueur doit être averti d'un déblocage où qu'il soit dans le jeu. La plateforme permet à un
module de fournir la source d'un canal temps réel (ADR 08, Taverne), mais cette source ne recevait
pas le nom du canal : elle ne pouvait servir qu'un canal unique, commun à tous les joueurs.

## Décision

- Le module conserve ses données dans des tables classiques, dans son schéma `achievements`
  (migration `0014_achievements`). Ces tables sont tenues par la projection `achievements` (version 1),
  qui lit le langage publié des trois modules, comme celle des Quêtes (ADR 11).
- La projection cumule une métrique par joueur (`counters`). À chaque évolution, elle applique la
  fonction pure `unlockedBy(avant, après)` du domaine, puis enregistre les hauts faits dont le seuil
  vient d'être franchi, datés par le champ `at` de l'événement.
- **Les hauts faits débloqués ne sont jamais retirés.** Le `reset` de la projection vide les métriques
  et les tables de travail, mais pas `unlocked`. Lors d'une reconstruction, l'insertion
  `ON CONFLICT DO NOTHING` sur l'index unique `(player_id, achievement)` conserve la date et
  l'identifiant d'origine.
- **Canal temps réel par joueur (bonus B1)** : `achievements-<joueur>`, réservé à ce joueur
  (`canSubscribe`). Sa source lit la table `unlocked` après avoir rattrapé la projection.
  L'identifiant croissant de chaque ligne sert de position au canal. Pour cela, la plateforme
  transmet désormais le nom du canal à la source :
  `ChannelSource.read(after, channel)` et `start(channel)`.
- Les notifications (`AchievementToasts`) sont rendues par le cadre de l'espace de jeu (`AppShell`),
  par l'entrée publique `achievements/ui.tsx`. Elles s'affichent donc sur chaque onglet.
- **Test de charge (bonus B7)** : `GET /api/achievements` est ajouté aux scénarios de
  `scripts/load-test.ts`, soumis au budget de `perf/budget.json`.

## Conséquences

### Positives

- Aucun module existant n'est modifié côté serveur : les Hauts faits ne font que lire le journal.
- Une reconstruction ne produit ni perte de haut fait, ni changement de date, ni nouvelle
  notification pour un haut fait ancien (test « conserve sa date lors d'une reconstruction »).
- La règle de déblocage est une fonction pure, testée indépendamment de la base.
- La modification de la plateforme est rétrocompatible : la source de la Taverne, qui ignore le nom
  du canal, est inchangée, et ses tests réussissent.

### Négatives

- Un haut fait attribué par erreur, après une règle de comptage fautive, n'est pas retiré par une
  reconstruction. Il faudrait une migration de données.
- Chaque abonné au canal déclenche un rattrapage de la projection à chaque lecture du flux, deux fois
  par seconde (dette DT-015).
- Le suivi des participants des expéditions et des acheteurs du Marché est dupliqué entre les Quêtes
  et les Hauts faits. Chaque module garde ainsi son autonomie, au prix de deux tables de travail
  semblables (dette DT-014).
- Après l'effacement d'un compte, une reconstruction recréerait les métriques et les hauts faits
  rattachés à l'identifiant pseudonymisé du joueur, comme pour le Classement (ADR 08).

## Alternatives écartées

- **Event Sourcing, avec un événement `AchievementUnlocked` par haut fait** : il dupliquerait des faits
  déjà présents dans le journal, et l'effacement d'un compte demanderait une réécriture
  supplémentaire. La permanence est obtenue plus simplement en excluant `unlocked` de la reconstruction.
- **Calculer les hauts faits à la lecture, sans les enregistrer** : la date d'obtention serait perdue,
  et il n'y aurait aucune position pour notifier un déblocage.
- **Un canal global, filtré par le navigateur** : chaque joueur recevrait les déblocages de tous les
  autres. Les données seraient trop exposées (règle 7), et le volume transmis inutile.
- **Écouter le journal (canal global) et recalculer dans le navigateur** : la règle de déblocage serait
  dupliquée côté client, et contournable.
- **Notifier par interrogation périodique de l'API** : le flux SSE existant (ADR 03) offre la reprise
  sans perte, par `Last-Event-ID`, sans rien à développer.

## Réexamen

Cette décision devra être réexaminée si le nombre de joueurs connectés rend le rattrapage par abonné
coûteux (DT-015), ou si les Quêtes et les Hauts faits doivent partager une même projection des
actions des joueurs.

## Usage de l'IA générative

Claude a proposé la conception du module, la modification de `ChannelSource` et une première rédaction de cet ADR.
J'ai posé le cadre, réfléchi à la structure et l'architecture du module, des fonctionnalités et de la façon de le faire.
L'IA générative était donc une aide, surtout rédactionnelle, pour implémenter les TU et refacto du code.
J'ai vérifié chaque point par les tests cités, par le test de charge exécuté sur la construction de production, et par un essai manuel : l'apparition du toast "Premier pas" à la fondation d'un village.