# ADR-NNNN - Event Sourcing comme mode de persistance du Village

- Statut : accepté
- Date : 2026-10-19

## Contexte

Dans le jeu, l'état du royaume et du village évolue en fonction de ce que fait le joueur (construction de nouveaux bâtiments, améliorations).

Pour la suite du jeu, nous avons besoin de diffuser les changements en temps réel (qui sera fait dans le TD5) et construire des vues de lecture à partir de l'activité des joueurs (dans le TD8).

Il nous reste également une contrainte au niveau de l'hébergement, avec plusieurs instances de l'application qui peuvent traiter simultanément des requêtes pour un même village.

## Décision

- L'état du village n'est pas stocké : il est reconstruit en rejouant ses événements. Cela nous permet de ne pas complexifier la logique avec l'évolution continue réalisée par le joueur.
- Les événements sont enregistrés dans un journal générique de la plateforme (`platform.events`), un flux par village, nommé `village-<joueur>`. Les données ne sont pas mélangées entre les joueurs.
- Les écritures concurrentes sont détectées par la contrainte d'unicité sur le flux et la version, et la commande est rejouée au plus trois fois.
- Un événement porte toutes les informations nécessaires à son application, comme le coût payé pour une amélioration.

## Conséquences

### Positives

- L'historique complet des actions d'un joueur est conservé, ce qui facilite l'audit et le débugage.
- Les événements peuvent être réutilisés pour alimenter les fonctionnalités de diffusion en temps réel prévues au TD5, sans modifier la logique métier existante.
- Les projections et vues de lecture du TD8 pourront être construites en rejouant les événements, sans dépendre du modèle d'écriture.
- Chaque événement étant autonome (coût payé, amélioration réalisée, etc.), les règles métier restent cohérentes même si les paramètres du jeu évoluent par la suite.

### Négatives

- La reconstruction de l'état nécessite de rejouer l'ensemble des événements d'un village, ce qui peut augmenter le temps de chargement lorsque leur nombre devient important, avec des joueurs tryhard par exemple.
- Un événement enregistré ne peut pas être modifié. En cas d'erreur ou d'évolution du modèle, il faut produire un nouvel événement correctif.
- Le modèle est plus complexe qu'un stockage direct de l'état.

## Alternatives écartées

- **Stockage direct de l'état dans une table du module**
- **Cooldown des requêtes** : Cette solution consistait à verrouiller les données d'un village pendant toute la durée d'une commande afin d'empêcher toute modification concurrente.

## Réexamen

Cette décision devra être réévaluée si le nombre d'événements par village devient suffisamment élevé pour rendre la reconstruction de l'état trop coûteuse en temps de calcul ou en accès à la base de données.

## Usage de l'IA générative

Suivi du TP étape par étape, puis implémentation de la nouvelle ressource manuellement.
Utilisation de l'IA pour trouver 2 des 3 conséquences négatives.