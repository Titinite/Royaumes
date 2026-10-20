**# ADR-03 - Server-Sent Events pour la diffusion des événements en temps réel**

- Statut : accepté
- Date : 2026-10-20

**## Contexte**

Dans le jeu, nous avons besoin d'informer les joueurs des changements sans avoir à recharger la page. Cela concerne d'abord les différents onglets d'un même joueur et permet d'avoir les modifications en direct dans le jeu sur les 2 onglets.

**## Décision**

- Les changements sont diffusés en temps réel par des Server-Sent Events.
- Un canal correspond exactement à un flux du journal d'événements. L'identifiant de chaque message correspond à la version de l'événement, ce qui permet de reprendre la diffusion efficacement.
- Le flux relit le journal toutes les demi-secondes et se ferme automatiquement au bout de 240 secondes. Le navigateur se reconnecte ensuite pour poursuivre la réception des événements.
- L'accès aux flux est réservé aux joueurs connectés. Chaque module déclare les règles d'accès à ses canaux.

**## Conséquences**

**### Positives**

- Les changements sont transmis sans rechargement manuel de la page, ce qui améliore le confort de jeu.
- La diffusion s'appuie sur le journal d'événements existant, sans nécessiter de système de messagerie supplémentaire ni de mémoire partagée entre les instances.
- Le rechargement de la vue depuis l'API permet de conserver une logique métier centralisée et évite de dupliquer le traitement des événements dans l'interface.

**### Négatives**

- Chaque connexion active entraîne une lecture du journal toutes les demi-secondes, ce qui peut augmenter la charge sur la base de données lorsque le nombre de joueurs connectés devient important.
- Un événement peut mettre jusqu'à environ une demi-seconde à être détecté par le flux, hors latence réseau et temps de traitement.
- À chaque notification, l'interface recharge sa vue depuis l'API, ce qui peut générer des requêtes supplémentaires et augmenter la charge du serveur.

**## Alternatives écartées**

- **WebSocket** : cette solution permet une communication bidirectionnelle en temps réel entre le navigateur et le serveur. Elle n'a pas été retenue, car le besoin actuel concerne principalement l'envoi de notifications du serveur vers le navigateur et que l'hébergement impose des contraintes de durée d'exécution et de gestion des connexions.

- **Interrogation périodique** : cette solution consiste à envoyer régulièrement des requêtes HTTP pour vérifier si de nouveaux événements sont disponibles. Elle a été écartée, car elle génère des requêtes même lorsque aucun changement n'a eu lieu et peut augmenter inutilement la charge de l'API et de la base de données.

- **Mécanisme de notification partagé entre instances** : l'utilisation de `LISTEN/NOTIFY` de PostgreSQL ou d'un service de messagerie permettrait de transmettre les notifications entre plusieurs instances. Cette solution n'a pas été retenue, car elle ajoute une complexité supplémentaire (elle pourrait être faisable).

**## Réexamen**

Cette décision devra être réévaluée si le nombre de joueurs connectés simultanément devient suffisamment important pour que les lectures répétées du journal surchargent la base de données.

Elle pourra également être revue si le jeu nécessite une communication bidirectionnelle à très faible latence, ou si l'hébergement propose une prise en charge stable des WebSocket adaptée aux besoins du projet.

Enfin, si les reconnexions fréquentes ou le rechargement des vues entraînent trop de requêtes, il pourra être nécessaire d'optimiser le mécanisme de diffusion ou d'introduire un système de notification partagé entre les instances.

**## Usage de l'IA générative**

Utilisation de l'IA pour rechercher ce qu'est un "Mécanisme de notification partagé entre instances" et pour débuguer un problème de timeOut sur 2 TU.