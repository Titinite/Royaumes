# ADR-10 - Module Quêtes : des tables classiques tenues par une projection, et un tirage déterministe

- Statut : accepté
- Date : 2026-10-23

## Contexte

Le module Quêtes propose chaque jour quatre objectifs à chaque joueur (fiche de cadrage :
`docs/evaluation/fiche-cadrage-quests.md`). Ses données ont trois origines différentes :
- **les quêtes du jour** : elles dépendent seulement du joueur et de la date
- **la progression** : elle se déduit d'actions déjà enregistrées dans le journal par le Village,
  le Donjon et le Marché (améliorations, expéditions, offres)
- **les récompenses réclamées** : c'est la seule donnée propre au module. Elle doit être
  enregistrée une seule fois par quête et par jour, car elle déclenche un versement de ressources.

Ces données n'ont de valeur que le jour même : une quête de la veille ne peut ni progresser
ni être réclamée (règle 3). 
L'historique des actions existe déjà dans le journal des autres modules. 

## Décision

- Les quêtes du jour ne sont pas stockées. Elles sont tirées par une fonction pure du domaine,
  `dailyQuests(playerId, day)`, à partir d'un générateur pseudo-aléatoire à graine (FNV-1a et
  mulberry32, comme au TD7). Un même joueur obtient donc les mêmes quêtes toute la journée.
- Le module conserve ses données dans des tables classiques, dans son propre schéma `quests`,
  créé par la migration `0013_quests` :
  - `counters` : la valeur de chaque métrique, par joueur et par jour ;
  - `villages`, `game_players`, `offer_buyers` : les tables de travail de la projection ;
  - `claims` : les récompenses réclamées.
- Les quatre premières tables sont tenues par la projection `quests` (ADR 11). `claims` est
  écrite par la commande de réclamation. Sa clé primaire `(player_id, day, kind)` garantit la
  règle 7, y compris pour deux réclamations simultanées.
- Le jour est calculé en temps universel (`dayOf`, au format AAAA-MM-JJ).
- **Tâche quotidienne (bonus B2)** : une tâche propre au module, exécutée par la tâche planifiée
  existante (`/api/cron/daily`), supprime la progression et les réclamations de plus de 7 jours.
- Le module n'enregistre aucun événement. Son contributeur `personal-data.ts` exporte et
  supprime les lignes du joueur, sans réécriture du journal.

## Conséquences

### Positives

- Aucune écriture n'est nécessaire pour attribuer les quêtes : il n'y a ni tâche de génération
  à minuit, ni ligne par joueur et par jour.
- La progression est reconstructible à tout moment à partir du journal (`rebuild`) : une
  correction d'une règle de comptage ne demande qu'une nouvelle version de la projection.
- La conservation limitée est simple à appliquer : c'est une suppression par jour, appuyée sur
  les index `counters_day_idx` et `claims_day_idx`.
- L'effacement d'un compte est une simple suppression ; le journal n'a pas à être réécrit.

### Négatives

- Une reconstruction de la projection ne doit jamais vider `claims` : `reset` l'exclut
  explicitement, et un test le vérifie. Une erreur sur ce point verserait une seconde fois des
  récompenses déjà reçues.
- Les quêtes changent à minuit UTC, soit 1 h ou 2 h du matin en France (dette DT-011).
- Le tirage n'est pas cryptographique : un joueur qui connaît l'algorithme peut prévoir ses
  quêtes. Cela ne lui donne aucun avantage, puisqu'il doit de toute façon les réaliser.
- Après une reconstruction, la progression des jours déjà purgés réapparaît jusqu'à la
  prochaine exécution de la tâche quotidienne.

## Alternatives écartées

- **Event Sourcing (decider) pour les réclamations** : un flux `quests-<joueur>` avec des
  événements `RewardClaimed` donnerait la concurrence optimiste et la boîte d'envoi par
  `store.append`. Mais ces données sont destinées à disparaître après 7 jours : il faudrait
  supprimer des événements, ce qui contredit la règle de l'ajout seul (ADR 02). Le TD10 a écarté
  ce modèle pour la même raison.
- **Enregistrer les quêtes du jour en base**, tirées par une tâche à minuit : cela ajoute une
  écriture par joueur et par jour, et une tâche qui doit avoir réussi avant toute consultation,
  sans aucun bénéfice par rapport à un tirage recalculable.
- **Calculer la progression à chaque lecture, directement à partir du journal** : le coût de
  chaque consultation croîtrait avec la taille du journal. C'est la dette DT-005, remboursée au
  TD8 par une projection.
- **Le fuseau Europe/Paris pour le changement de jour** : c'est plus juste pour les joueurs,
  mais demande une gestion des heures d'été et d'hiver dans le domaine et dans les tests. C'est
  reporté et consigné en dette (DT-011).

## Réexamen

Cette décision devra être réexaminée si les quêtes doivent conserver un historique ayant une
valeur de jeu (séries de jours consécutifs, classement des quêtes). 
Le journal d'événements redeviendrait alors pertinent pour les réclamations.

## Usage de l'IA générative

Claude a proposé le découpage entre données tirées, projetées et réclamées, ainsi qu'une première rédaction de cet ADR. 
J'ai réflechi à toute la structure, le contexte et le fonctionnement du module ainsi que des premiers jets sur le code.
J'ai ensuite demandé à Claude de me refactoriser le code et de me générer les tests unitaires (`daily.test.ts`, `quests-projection.test.ts`, `quests-service.test.ts`)