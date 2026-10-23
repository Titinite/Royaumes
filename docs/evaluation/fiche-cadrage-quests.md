# Fiche de cadrage : Les Quêtes

- Auteur : Thibault LERAY
- Date : 2026-10-22
- Nom technique du module : `quests`

## L'idée

Chaque jour, le joueur reçoit des objectifs, réalisés par ses actions dans les autres modules.
Cela prendrait la forme d'un nouvelle onglet avec 4 quêtes quotidiennes à réaliser (terminer un donjon, améliorer un bâtiment...).
Chaque quête terminée donne une récompense au joueur (des ressources pour son village).
De plus, une fois les 4 quêtes terminées, le joueur reçoit une récompense bonus : un tag "à terminer ses quêtes quotidiennes" visible
dans le chat de la Taverne.

C'est un vrai plus pour le jeu car cela encourage le joueur à revenir tous les jours et le contraint à passer un peu de temps sur le jeu.

## Les règles métier

Les règles que le domaine du module devra faire respecter, numérotées. Chacune devra
être vérifiée par au moins un test.

1. Chaque jour, des nouvelles quêtes (aléatoires dans une liste) apparaissent pour les joueurs
2. Une quête terminée accorde une récompense ressource pour le village
3. Si les 4 quêtes sont terminées, le joueur obtient le badge "à terminer ses quêtes quotidiennes" visible dans le chat de la Taverne

## Les commandes et les lectures

| Action du joueur | Commande ou lecture | Route envisagée |
| --- | --- | --- |
| Consulter ses quêtes du jour et leur progression | Lecture | `GET /api/quests` |
| Réclamer la récompense d'une quête terminée | Commande | `POST /api/quests/:id/claim` |
| Voir les joueurs qui ont le badge du jour (Taverne) | Lecture | `GET /api/quests/champions` |

## Le stockage envisagé

Tables classiques, dans le schéma `quests`.
Les données des quêtes n'ont de valeur que le jour même : elles sont destinées à disparaître, ce qui se
prête mal au journal d'événements. 
L'historique des actions existe déjà dans le journal des autres modules et celui-ci n'a qu'une vue de lecture, tenue par une projection.

## La communication avec les modules existants

- **Village, Donjon, Marché -> Quêtes** : lecture du langage publié. Une projection lit dans le journal les événements `VillageFounded`, `BuildingUpgraded` (Village), `GameCreated`, `PlayerJoined`, `GameEnded` (Donjon), `OfferPublished` et `OfferAccepted` (Marché), et met à jour la progression des quêtes (en fonction de ce qu'est la quête, évidement).
- **Quêtes -> Village** : message `realm.deposit` par la boîte d'envoi, pour verser la récompense. L'identifiant du versement est déterminé par le joueur, le jour et la quête : un doublon n'est versé qu'une fois.
- **Taverne -> Quêtes** : l'écran de la Taverne lit `GET /api/quests/champions` pour afficher le badge.

## Les données personnelles

La progression des quêtes et les récompenses réclamées de chaque joueur, rattachées à son identifiant.
Elles sont conservées 7 jours, puis supprimées par la tâche quotidienne. 
Elles sont incluses dans l'export et supprimées avec le compte.

## Les bonus visés

1. B4 : modèle de lecture tenu par une projection, avec point de reprise et version.
2. B6 : communication avec au moins deux modules existants (Village, Donjon, Marché).
3. B2 : tâche quotidienne propre au module (purge des quêtes de plus de 7 jours)
4. B1 : canal temps réel `quests-<userId>`, pour voir la progression sans recharger.
5. B8 : nouvelle fonction d'aptitude (aucune route du module sans `requireUser`).
6. B10 : test Playwright du parcours : de la validation d'une quête à la réclamation