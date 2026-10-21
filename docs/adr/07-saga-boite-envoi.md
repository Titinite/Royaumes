# ADR-07 - Les opérations qui concernent plusieurs modules sont des sagas orchestrées, dont les messages transitent par une boîte d'envoi transactionnelle

- Statut : accepté
- Date : 2026-10-21

## Contexte

Nous voulons créer un espace Marché pour échanger des ressources avec d'autres joueurs.
Un échange du Marché modifie les données du Marché et celles de deux villages, et ne doit ni créer ni perdre de ressources.

La règle d'encapsulation des modules (TD2), et la perspective de l'extraction d'un module dans un service doté de sa propre base (TD11).
L'hébergement ne permet aucun processus permanent (ADR 0004).

## Décision

- Une transaction ne modifie jamais les données que d'un seul module.
- Une opération qui concerne plusieurs modules est une saga ; ses étapes compensables, pivot et reprises jusqu'au succès sont identifiées.
- La saga est orchestrée par le module qui porte l'opération ; les participants ne connaissent pas la saga, et répondent à l'adresse de retour indiquée dans chaque demande.
- Les messages sont enregistrés dans la boîte d'envoi de la plateforme, dans la même transaction que les événements qui les déclenchent.
- La distribution est garantie au moins une fois : bail, nouvel essai avec recul exponentiel, abandon après dix tentatives.
- Chaque gestionnaire est idempotent, grâce à une clé d'idempotence choisie par le demandeur.
- La distribution a lieu après chaque commande et chaque consultation du Marché, et chaque jour par une tâche planifiée protégée par un secret.

## Conséquences

### Positives

- Aucun module n'écrit dans les données d'un autre puisque les usages sont bien séparés
- Une panne à n'importe quel moment ne perd ni ne duplique aucune ressource
- Le Village peut servir d'autres demandeurs sans modification 
- La boîte d'envoi sert aussi de minuterie
- Le déroulement de la saga se lit en un seul endroit

### Négatives

- Des états intermédiaires visibles des joueurs, comme une offre en règlement
- Une latence qui dépend de l'activité : une saga interrompue ne reprend qu'à la consultation suivante du Marché, ou le lendemain
- L'obligation d'écrire des gestionnaires idempotents, et de tester leurs doublons
- Des messages abandonnés qu'aucun outil ne permet encore d'examiner (dette DT-007)
- Une table de la boîte d'envoi qui grandit sans limite, les messages traités étant conservés

## Alternatives écartées

- **Une transaction unique englobant les données des deux modules** : cela obligerait le Marché à modifier directement les données du
Village, ce qui violerait l'encapsulation des modules et compliquerait leur séparation en services indépendants
- **Une transaction distribuée par validation en deux phases** : cette solution complexifierait l'architecture et nécessiterait une
coordination entre plusieurs modules et bases de données, sans être adaptée aux contraintes de l'hébergement de Vercel
- **Un appel direct du Village par le Marché, sans boîte d'envoi** : une panne après la validation de la transaction pourrait empêche
l'appel ou sa réponse, sans mécanisme fiable pour reprendre l'opération

## Réexamen

Cette décision devra être réexaminée si le volume des messages rend leur distribution trop lente, si les consultations du Marché ne
suffisent plus à reprendre les sagas interrompues, ou si la tâche planifiée quotidienne ne garantit plus une reprise suffisamment
rapide. 
Elle devra également être revue si les messages abandonnés nécessitent un outil de supervision et de reprise, si la croissance
de la boîte d'envoi devient problématique, ou si les échanges exigent une garantie de disponibilité plus forte.

## Usage de l'IA générative

Utilisation de ChatGPT pour liste les scénarios nécessitant un réexamen.