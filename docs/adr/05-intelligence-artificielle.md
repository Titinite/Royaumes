# ADR-05 - Une intelligence artificielle déterministe, exécutée dans le domaine, sans tâche de fond

- Statut : accepté
- Date : 2026-10-20

## Contexte

Des monstres dont le comportement dépend d'un niveau de difficulté, et des compagnons qui permettent de jouer seul : ce sont les
améliorations qui permettent d'améliorer le gameplay de notre jeu et de le rendre plus fun.

L'hébergement ne permet aucun processus permanent (ADR 04). L'état d'une expédition est reconstruit à partir de ses événements,
et une manche peut être calculée lors d'une lecture sans être enregistrée (ADR 0002 et 0004).

## Décision

- Les décisions de l'intelligence artificielle sont des fonctions pures du domaine, appelées au moment de la résolution d'une manche.
- Elles ne tirent au sort qu'au moyen du générateur de la manche.
- Leurs résultats, actions des compagnons comprises, sont enregistrés dans l'événement `RoundResolved`.
- Le comportement des monstres est isolé derrière un port de stratégie, dont chaque niveau de difficulté fournit une mise en œuvre.
- Un compagnon n'agit que si au moins un joueur a choisi une action pour la manche.
- L'équilibre du jeu est mesuré par simulation, et protégé par des tests statistiques.

## Conséquences

### Positives

- Permet de jouer en solo : en ajoutant un compagnon, je peux plus facilement jouer en solo que si je n'ai pas cette possibilité
- Ne scripte pas le jeu : un comportement aléatoire mais calculé pour notre bot permet un meileur gameplay sans rentrer dans du scripté (le bot ne sait pas ce que fait le monstre et le joueur, et inversement)
- Le bot ne peut pas jouer sans action d'un vrai joueur, ce qui garde le côté JcC de base

### Négatives

- Impossibilité pour un personnage piloté par l'ordinateur d'agir entre deux échéances puisqu'une action d'un vrai joueur est nécessaire
- La qualité de l'équilibre dépend de la règle suivie par les joueurs simulés puisqu'elle peut devenir un peu plus scripté en rendant
la partie plus simple ou plus compliquée
- Le bot peut prendre une décision innatendue par le joueur et hiriter ce dernier

## Alternatives écartées

- **Une boucle de jeu exécutée par un processus permanent** : incompatible avec l'hébergement, qui ne permet pas de processus permanent (ADR 04)
- **Des décisions prises par le navigateur d'un joueur** : cette solution permettrait aux joueurs de modifier les décisions du bot et compromettrait l'équité du jeu
- **Un recalcul des décisions lors de la relecture plutôt que leur enregistrement** : les résultats pourraient changer selon le générateur utilisé et compliqueraient la reconstruction fidèle de l'expédition

## Réexamen

Cette décision devra être réexaminée si le jeu nécessite des personnages capables d'agir en temps réel sans intervention d'un joueur, si les calculs de l'IA deviennent trop coûteux lors de la résolution d'une manche, ou si les simulations révèlent un déséquilibre important du gameplay.

## Usage de l'IA générative

ChatGPT a été utilisé pour aider à comprendre les 3 alternatives proposées en exemple. 
Le contenu a été vérifié par rapport aux décisions techniques et aux contraintes du projet.