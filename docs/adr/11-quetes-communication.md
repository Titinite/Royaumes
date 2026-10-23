# ADR-11 - Communication des Quêtes : lecture du langage publié par une projection, et versement par la boîte d'envoi

- Statut : accepté
- Date : 2026-10-23

## Contexte

Les Quêtes communiquent avec trois modules existants, dans deux sens :
- **Village, Donjon et Marché -> Quêtes** : la progression dépend des actions du joueur dans ces
  modules (règle 4). Ils ne doivent pas connaître les Quêtes ni être modifiés pour elles.
- **Quêtes -> Village** : réclamer une récompense doit créditer le village du joueur, une seule
  fois, même en cas de panne entre les deux écritures.
- **Taverne -> Quêtes** : la Taverne affiche le badge des joueurs qui ont terminé leurs quêtes
  du jour (règle 9).

## Décision

- **Lecture du langage publié (bonus B4 et B6)** : la projection `quests` (version 1) lit
  `VillageFounded`, `BuildingUpgraded`, `GameCreated`, `PlayerJoined`, `GameEnded`,
  `OfferPublished`, `OfferAccepted`, `TradeCompleted` et `OfferWithdrawn`. Elle n'importe que les
  `contracts.ts` des autres modules (préfixes des flux). Elle est rattrapée avant chaque lecture.
  Son point de reprise et sa version sont gérés par le moteur de la plateforme.
- Une action est comptée pour le jour indiqué par la date `at` de l'événement, c'est-à-dire
  l'horloge du module qui la publie. À défaut, c'est sa date d'enregistrement. Un achat n'est
  compté qu'à `TradeCompleted` : l'acheteur est retenu dans `offer_buyers` depuis
  `OfferAccepted`.
- **Versement de la récompense** : la réclamation insère la ligne de `claims` et le message
  `realm.deposit` dans une même transaction. Pour cela, la plateforme expose une nouvelle
  fonction, `enqueue(tx, messages)`, à côté de `toOutboxRow`. Le `transferId` est déterminé par
  le joueur, le jour et la quête (`quest-<jour>-<quête>-<joueur>`). La boîte d'envoi est
  distribuée aussitôt après la réclamation, puis chaque jour par la tâche planifiée.
- **Badge** : l'écran de la Taverne lit `GET /api/quests/champions`, par le hook `useChampions`
  exporté par l'entrée publique `quests/ui.tsx`. Ni le serveur de la Taverne ni ses tables ne
  sont modifiés.
  J'ai hésité avec l'utilisation d'un nouveau champ dans le user mais cela aurait empêché une vraie
  archi qui séparent les modules.

## Conséquences

### Positives

- **Livraison au moins une fois** : le message est enregistré si et seulement si la
  réclamation l'est. Un message non remis est retenté par le distributeur.
- **Idempotence** : un doublon du message porte le même `transferId`, et le Village l'ignore
  (gestionnaire existant, test d'API « une seule fois »). Une seconde réclamation est refusée
  par la clé primaire de `claims`, sans nouveau message (test des réclamations simultanées).
- **Aucun module existant n'est modifié côté serveur.** Le Village est utilisé tel quel, par son
  contrat `REALM_TOPICS.deposit`. Le Donjon et le Marché ignorent l'existence des Quêtes.
- La projection applique chaque événement exactement une fois, et une reconstruction donne la
  même progression, puisque le jour vient des événements.

### Négatives

- **Cohérence différée** : le versement est asynchrone. Si le Village échoue, la quête apparaît
  « réclamée » avant que les ressources n'arrivent, jusqu'au prochain essai du distributeur.
- La projection dépend de la forme des événements des autres modules (`hostId`, `buyerId`,
  `result`, `at`). Renommer l'un de ces champs casserait les Quêtes sans erreur de compilation :
  ce couplage est couvert par `quests-projection.test.ts` et par les tests d'API de bout en bout.
- `enqueue` est une modification de la plateforme. Elle est rétrocompatible et testée
  (`outbox.test.ts`), mais un module pourrait l'appeler hors transaction et perdre la garantie
  d'atomicité.
- Le badge est recalculé à chaque lecture pour tous les joueurs actifs du jour (dette DT-012).

## Alternatives écartées

- **Un message envoyé par chaque module aux Quêtes** (`quests.progress`) : il faudrait modifier
  le Village, le Donjon et le Marché pour publier un message à chaque action. Cela crée un
  couplage dans le mauvais sens, alors que leurs événements contiennent déjà l'information.
- **Appeler directement le service du Village** pour verser la récompense : deux écritures sans
  transaction commune ; une panne entre les deux ferait perdre une récompense ou la verserait
  deux fois. Cela contredit l'ADR 07.
- **Écrire dans `platform.outbox` depuis le module** : interdit par la règle
  `platform-tables-are-private`. Contourner une règle de dependency-cruiser est exclu (E9).
- **Une saga avec réponse du Village** (`replyTo`) : un versement ne peut pas être refusé tant
  que le village existe, et la règle 8 vérifie ce point avant la réclamation. Une étape de
  compensation n'apporterait rien.
- **Ajouter le badge dans les messages de la Taverne côté serveur** : cela modifierait l'API et
  le stockage de la Taverne pour une donnée qui n'est valable qu'un jour.

## Réexamen

Cette décision devra être réexaminée si un autre module doit réagir à la réussite d'une quête,
ou si les Quêtes doivent pouvoir refuser une récompense (village supprimé entre-temps). 
Une saga avec réponse, ou la publication d'événements par les Quêtes, deviendrait alors nécessaire.

## Usage de l'IA générative

Claude a proposé l'ajout de `enqueue` à la plateforme, la datation par `at`, et une première rédaction de cet ADR.
J'ai réflechi à toute la structure, le contexte et le fonctionnement du module ainsi que des premiers jets sur le code.
J'ai ensuite demandé à Claude de me refactoriser le code et de me générer les tests unitaires.
J'ai vérifié les garanties annoncées par les tests (doublon, réclamations simultanées, transaction annulée, versement effectif au village dans `quests-api.test.ts`) et par un essai manuel sur le déploiement et la version locale.