# ADR-04 - Des manches simultanées, aux échéances paresseuses, pour les combats du Donjon

- Statut : accepté
- Date : 2026-10-20

## Contexte

On souhaite ajouter à notre jeu un mode "multijoueur" avec des connexions entre joueurs humains (pas de bots pour le moment).
C'est derniers de doivent pas s'attendre indéfiniment (à chaque tour), et ne pas être avantagés dans l'ordre de jeu (roulement).
Avec nos contraintes techniques, l'hébergement utilisé ne permet pas d'avoir un minuteur en mémoire ou des tâches de fond.
De plus, les tâches planifiées ne peuvent s'exécuter qu'une fois par jour.

L'état d'une expédition est reconstruit à partir de ses événements (ADR 0002) : tout calcul doit être reproductible.
Aussi, les choix des joueurs doivent rester secrets jusqu'à la résolution de la manche. Cela permet un meilleur gameplay
et ajoute du challenge au jeu.

## Décisions

- Les héros choisissent simultanément ; la manche est résolue lorsque tous ont choisi ou lorsque son échéance de trente secondes est atteinte, et un héros sans choix se défend.
- L'échéance est enregistrée dans les événements ; une manche échue est résolue à l'instant de son échéance.
- Une lecture calcule la résolution des manches échues sans rien enregistrer ; toute commande commence par l'enregistrer ; le navigateur envoie une commande d'échéance lorsque son compte à rebours atteint zéro.
- Le hasard est tiré dans `decide`, avec un générateur à graine dérivée du numéro de manche, et ses résultats sont enregistrés dans les événements.
- Une action porte le numéro de la manche visée, et est refusée si cette manche est résolue.

## Conséquences

### Positives

- Les choix simultanés empêchent les joueurs de s'adapter aux décisions des autres pendant la manche. L'échéance de trente secondes évite les attentes indéfinies.

- L'échéance, les résultats aléatoires et les événements permettent de reconstruire l'état d'une expédition de manière déterministe. Le système fonctionne sans minuteur en mémoire ni tâche de fond permanente.

- Le calcul des manches à la lecture permet d'obtenir un état à jour. L'enregistrement préalable au traitement des commandes et le numéro de manche associé à chaque action empêchent les actions tardives de modifier une manche déjà résolue.

### Négatives

- Sans tâche de fond, si aucun joueur ne revient à la fin du tour, la résolution peut ne pas être enregistrée immédiatement, même si son résultat  est déterminable.

- Il faut garantir qu'une manche terminée ne soit enregistrée et résolue qu'une seule fois, même lorsque plusieurs commandes arrivent simultanément. La gestion des échéances, des graines aléatoires et des événements augmente également la complexité des tests.

- Le délai fixe de trente secondes peut être trop court pour certains joueurs ou trop long pour d'autres ce qui peut entraîner de la frustration en cas de latence réseau.

## Alternatives écartées

- **le tour par tour strict** : il permet de ne pas gérer les personnes qui ont beaucoup de ping par exemple puisque le jeu n'avance pas tant que l'action n'est pas réalisée. Cependant, cette alternative bloque littéralement le jeu et la situation peut durer longtemps.
- **un minuteur ou une tâche planifiée** : permet de faire jouer le joueur automatiquement à partir d'un certain moment. C'est déjà un peu le cas mais seulement si l'action est trop longue. En cas de décalage lié au réseau, une personne avec 10ms de ping verra le résultat plus vite que celle avec 1200ms de ping.
- **une lecture qui enregistre elle-même la résolution**
- **un tirage par `Math.random` dont seul le résultat serait enregistré** : enlève toute la partie challenge et immersive car le joueur n'est plus maître de ses actions, c'est simplement un spectateur.

## Réexamen

Cette décision devra être réexaminée si :
- la résolution différée des manches entraîne des problèmes de cohérence ou des délais perceptibles pour les joueurs
- le nombre de joueurs simultanés augmente au point de rendre la gestion des commandes concurrentes plus difficile à garantir
- l'hébergement permet l'utilisation d'un mécanisme de planification ou d'un service temps réel adapté, susceptible de simplifier la gestion des échéances (actuellement non)

## Usage de l'IA générative

Aucun