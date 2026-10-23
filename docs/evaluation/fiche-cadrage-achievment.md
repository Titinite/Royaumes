# Fiche de cadrage : Les Hauts faits

- Auteur : Thibault LERAY
- Date : 2026-10-22
- Nom technique du module : `achievments`

## L'idée

Des distinctions attribuées automatiquement lorsqu'un joueur atteint certains seuils.

Concrètement, des succès, sur le même principe que les quêtes mais qui ne sont pas limités par le temps et non renouvelables.
Lorsqu'on en débloque un, la date d'obtention est inscrite.

Cela apporte un challenge supplémentaire pour les joueurs, qui vont vouloir en terminer le maximum.

## Les règles métier

Les règles que le domaine du module devra faire respecter, numérotées. Chacune devra
être vérifiée par au moins un test.

1. La liste de tous les succès du jeu est accessible par n'importe quel joueur (on voit les succès terminés et non terminés)
2. Lorsque le joueur fait une certaine action, il augmente sa progression sur un succès (réussir 5 donjons par exemple)
3. Lorsqu'un succès est terminé, il apparait validé et s'ajoute au nombre de succès validés par le joueur (avec un système de
notification toast in-game dès qu'un nouveau est achevé)
4. La date d'obtention est celle de l'action qui a fait atteindre le seuil, et non celle du calcul donc elle reste identique si les succès sont recalculés

## Les commandes et les lectures

| Action du joueur | Commande ou lecture | Route envisagée |
| --- | --- | --- |
| Consulter le catalogue et sa progression | Lecture | `GET /api/achievements` |
| Être averti d'un haut fait débloqué | Commande et Lecture | `achievements-<userId>` |

## Le stockage envisagé

Tables classiques, dans le schéma `achievements`
Les compteurs et succès débloqués se déduisent entièrement des événements déjà présents dans le journal des autres modules : ils forment un modèle de lecture, tenu par une projection et reconstructible à tout moment. 
Les enregistrer à nouveau dans le journal dupliquerait l'information.

## La communication avec les modules existants

- **Village, Donjon, Marché -> Succès** : lecture du langage publié. Une projection lit dans le journal les événements `VillageFounded`, `BuildingUpgraded` (Village), `GameCreated`, `PlayerJoined`, `GameEnded` (Donjon), `OfferPublished` et `OfferAccepted` (Marché)

## Les données personnelles

Les compteurs et succès débloqués de chaque joueur, avec leur date d'obtention, rattachés à son identifiant. 
Conservés tant que le compte existe, inclus dans l'export et supprimés avec le compte.

## Les bonus visés

1. B4 : modèle de lecture tenu par une projection, avec point de reprise et version
2. B6 : communication avec au moins deux modules existants (Village, Donjon, Marché)
3. B1 : canal temps réel `achievements-<userId>`, réservé à son propriétaire, pour la notification
4. B7 : test de charge sur `GET /api/achievements`, dans le budget de performance
5. B10 : test Playwright du parcours de déblocage + visibilité dans la liste