# ADR-08 - Un stockage classique pour la Taverne, et la réécriture ciblée des champs personnels du journal pour l'effacement

- Statut : accepté
- Date : 2026-10-21

## Contexte

Pour correspondre avec les normes en vigueur, notament le RGPD, nous avons besoins des droits d'accès, de portabilité et d'effacement qui portent sur le jeu entier : concrètement, ce sont des messages et une présence destinés à disparaître.

Actuellement, nous avons des noms de joueurs qui sont dupliqués dans les évènements du Donjon et du Marché et un nom de village dans
le module Village. Le problème est qu'ils ont des flux partagés avec d'autres joueurs.

La règle de l'ajout seul du journal (ADR 02), et les projections qui en dépendent (ADR 06).

## Décision

- La Taverne utilise des tables ordinaires, dont les lignes sont supprimées à l'expiration de leur durée de conservation.
- Son canal temps réel est alimenté par une source fournie par le module.
- La présence repose sur un signal périodique ; une ligne par joueur présent, supprimée à son départ ou deux minutes après son dernier signal.
- Les durées de conservation sont appliquées à la lecture, et chaque jour par la route des tâches quotidiennes.
- Chaque module déclare ses données personnelles par un contributeur : export, réécriture de ses événements, effacement de ses tables.
- L'effacement réécrit les seuls champs de nom des événements du joueur, par une fonction unique de la plateforme, et le consigne dans un registre qui ne contient aucune donnée sur le joueur.
- L'identité est effacée en dernier ; chaque étape est idempotente.

## Conséquences

### Positives

- Les joueurs ont la possiblité d'exercer leurs droits d'accès, de portabilité et d'effacement sans nécessité une intervention d'un
administrateur de la plateforme (boutons cliquables depuis le compte du joueur)
- L'effacement des noms dans le journal préserve les états reconstruits et l'historique des autres joueurs pour ne pas affecter
l'expérience
- Les durées de conservation sont respectées même en l'absence d'activité
- La Taverne utilise un stockage classique, ce qui est plus simple à gérer qu'un journal d'évènements pour des messages temporaires.
- La présence des joueurs est actualisée automatiquement et les joueurs absents sont supprimés après expliration

### Négatives

- L'effacement constitue une exception à la règle de l'ajout seul du journal, que toute évolution future devra respecter
- L'export et l'effacement peuvent devenir coûteux suivant la taille du journal d'événements
- Chaque nouveau type d'événement doit déclarer ses champs personnels dans le contributeur de son module sinon l'effacement de ces
dernières pourrait ne pas être fonctionnel
- Des identifiants restent présents dans le journal après l'effacement

## Alternatives écartées

- **Utiliser l'Event Sourcing pour la Taverne** : les messages temporaires seraient inutilement complexes à gérer et à supprimer, alors que des tables classiques permettent une suppression directe à l'expiration

- **Supprimer les flux du joueur** : les flux étant partagés avec d'autres joueurs, leur suppression ferait perdre des événements nécessaires à la reconstruction de leurs parties et certaines données seraient perdues

- **Utiliser des références sans copier les noms dans les événements** : cette solution limiterait la duplication des données personnelles, mais demanderait de modifier le fonctionnement des événements et leur lecture existante. Cependant, ça peut être intéressant pour les nouveaux modules.

## Réexamen

Cette décision devra être réexaminée si un nouveau module est créé, afin de privilégier les références aux données personnelles plutôt que leur duplication dans les événements. Elle devra également être revue si la taille du journal rend l'export ou l'effacement trop long pour une requête, ou si la réglementation ou la doctrine applicable à l'anonymisation des identifiants pseudonymes évolue.

## Usage de l'IA générative

Aucun