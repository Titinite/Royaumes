# ADR-09 - L'extraction du Village en service autonome, préparée mais non déployée

- Statut : accepté
- Date : 2026-10-21

## Contexte

L'ADR 01 promet que les frontières entre les modules soient assez strictes pour qu'un module puisse être extrait, et réutilisé dans
un autre projet.

Extraire un module permet de réutiliser du code sans tout redévelopper et de ne pas réinventer la roue systèmatiquement.
C'est un gain de temps considérable.

De ce fait, 2 modifications à faire concernant les dépendances du Village au niveau de l'inventaire : le Classement et le canal en temps réel utilisent tout deux les évènements du journal commun, ce qui empêche l'extraction de ce module.

## Décision

- Le Village peut s'exécuter dans un service autonome, doté de sa propre base, de son propre journal et de sa propre boîte d'envoi.
- L'application devient alors une passerelle : elle reçoit une version distante du module Village, de même forme que la version exécutée dans le processus.
- Les messages de la saga franchissent la frontière par une boîte de réception, sans modifier les garanties de la boîte d'envoi.
- Un relais recopie le flux d'événements publié par le service dans le journal de l'application, où le Classement et le canal temps réel continuent de le lire.
- Les échanges entre les deux processus sont authentifiés par un secret partagé, qui n'est jamais versionné.
- Le service n'est pas déployé : en production, le Village s'exécute dans l'application.

## Conséquences

### Positives

- Les frontières entre modules sont vérifiées concrètement
- Six tests de contrat vérifient ces frontières à chaque construction
- L’extraction est réversible, sans migration de données
- La boîte de réception et l’authentification entre services sont réutilisables
- Le coût réel de l’extraction est mesurable

### Négatives

- Deux modes d’exécution du Village doivent être maintenus
- La copie des événements dans le journal de l’application entraîne une cohérence différée
- Des dettes techniques doivent être résolues avant le déploiement
- Une fuite du secret partagé permettrait d'usurper l'identité de n'importe quel joueur auprès du service

## Alternatives écartées

- **Déployer le service immédiatement** : trop risqué avant la résolution des dettes techniques
- **Ne pas extraire le Village** : les frontières resteraient théoriques et non vérifiées
- **Lire directement le flux du service** : couplerait le Classement et le canal temps réel au service distant

## Réexamen

Revoir cette décision si le Village dépasse son budget de charge alors que les autres modules le respectent, le Village doit être déployé plus fréquemment que le reste du jeu ou que le coût de maintenance des deux modes d'exécution devient trop important.

## Usage de l'IA générative

ChatGPT a aidé à structurer et à rédiger les conséquences et les les alternatives. Le contenu a été vérifié au regard de l'architecture et des tests du projet.