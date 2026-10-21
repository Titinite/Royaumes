# ADR-06 - Séparer les modèles de lecture du modèle d'écriture, et les tenir à jour par des projections rattrapées à la lecture

- Statut : proposé | accepté | remplacé par ADR-XXXX | abandonné
- Date : 2026-10-21

## Contexte

A ce stade du projet, nous avons besoin de lectures qui traversent le flux, le classement et la liste des expéditions ouvertes,
dont le calcul par rejeu croît avec l'historique du jeu (dette DT-005). 

Pour rappel, l'hébergement ne permet aucun processus permanent (ADR 04).

Le journal attribue à chaque événement une position globale, croissante mais non continue (ADR 02).

## Décision

- Les lectures transversales s'appuient sur des modèles de lecture, placés dans le schéma PostgreSQL de leur module ; les décisions s'appuient toujours sur le modèle d'écriture.
- Chaque modèle de lecture est tenu à jour par une projection, dont le point de reprise est enregistré dans la table `platform.projections`.
- Une projection est rattrapée au moment de sa consultation, dans une seule transaction, le point de reprise étant verrouillé.
- Le rattrapage s'arrête devant une position manquante tant que l'événement qui la suit a moins de cinq secondes.
- Chaque projection porte une version : une version plus élevée que celle des tables provoque leur reconstruction, une version moins élevée interdit toute écriture.
- Le classement est annoncé aux navigateurs par un canal global et discret ; l'interface relit le classement jusqu'à ce que la projection ait atteint la position annoncée.

## Conséquences

### Positives

- Le coût des consultations dépend moins de la taille de l'historique, car elles lisent directement les modèles de lecture
- Les modules qui produisent des événements n'ont pas besoin de connaître les projections qui les exploitent
- De nouvelles informations peuvent être calculées à partir de l'historique existant sans modifier les événements passés
- Aucune tâche de fond ni intervention manuelle n'est nécessaire après un déploiement pour mettre à jour les projections
- Les projections peuvent être reconstruites à partir du journal en cas de changement de leur structure ou de leur logique ce qui permet
une évolutivité

### Négatives

- Cohérence à terme : un modèle de lecture peut avoir quelques secondes de retard sur le journal ce qui peut rendre les choses
moins adaptées
- Reconstruction coûteuse : elle se déroule pendant une consultation donc peut être bloquant si le journal est grand
- Dépendance aux événements des autres modules : le classement dépend du langage publié par les modules producteurs. 
- Contention lors des consultations simultanées : plusieurs demandes de rattrapage peuvent se retrouver en attente du verrou du point de
reprise.

## Alternatives écartées

- **Mettre à jour les modèles de lecture directement dans les commandes** : cela couplerait les modules producteurs aux modèles de
lecture et compliquerait l'ajout de nouveaux lecteurs
- **Utiliser une tâche planifiée** : cette solution nécessite un mécanisme d'exécution périodique, qui n'est pas adapté aux contraintes
de l'hébergement avec Vercel
- **Utiliser un processus de fond abonné au journal** : ce processus permanent n'est pas compatible avec l'hébergement sur Verce
(ADR 04)
- **Conserver le calcul par rejeu à chaque consultation** : le coût continuerait d'augmenter avec la taille du journal, sans résoudre la
dette technique DT-005

## Réexamen

Cette décision devra être réexaminée si la reconstruction d'une projection approche la durée maximale d'exécution d'une fonction Vercel,
si les consultations simultanées font du verrou du point de reprise un goulet d'étranglement, ou si le jeu nécessite des lectures
strictement à jour. Elle devra également être réévaluée si les changements du langage des événements entraînent trop fréquemment des
oublis dans les projections.

## Usage de l'IA générative

Utilisation de Claude pour comprendre les décisions prises et le fonctionnement de certaines.