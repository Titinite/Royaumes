# Revue de conformité au RGPD

- Date : 2026-10-21
- Périmètre : données personnelles de l'ensemble du jeu, export et effacement, durées de conservation, journaux techniques.
- Références : RGPD, articles 5, 15, 17, 20, 25 et 30 ; registre des traitements ; ADR 08.

| N° | Exigence | Vérification | Constat | Statut |
| --- | --- | --- | --- | --- |
| R1 | Chaque emplacement de données personnelles figure au registre des traitements | Comparaison du registre et de l'inventaire de la sous-partie 1.2 du TD10 | Le registre couvre toutes les tables et tous les emplacements contenant des données personnelles | Conforme |
| R2 | L'export contient toutes les données du joueur, module par module | Test « exporte les données du joueur, module par module, en un fichier JSON » ; lecture d'un export réel | L’export inclut les données du joueur dans chaque module | Conforme |
| R3 | L'export ne contient ni les données des autres joueurs, ni les secrets du jeu ou du compte | Test « ne contient ni les données des autres joueurs, ni les secrets du jeu » ; recherche de « password » et « token » dans un export | L’export ne contient ni données d’autres joueurs, ni mots de passe, jetons ou autres secrets | Conforme |
| R4 | Après la suppression d'un compte, son nom et celui de son village n'apparaissent plus dans aucune table | Suppression d'un compte de test, puis recherche de son nom dans toutes les tables | Après suppression, le nom du joueur et celui de son village ont disparu de toutes les tables | Conforme |
| R5 | L'effacement est tracé, sans conserver de donnée sur le joueur, et peut être relancé | Tests « enregistre l'effacement dans le registre... » et « peut être relancé sans effet supplémentaire » | L’effacement est enregistré sans conserver de données permettant d’identifier le joueur, et pouvoir être relancé sans effet supplémentaire | Conforme |
| R6 | Les messages de la Taverne ne sont pas conservés plus de trente jours, même sans visite | Tests de la durée de conservation ; compte rendu de la tâche quotidienne dans les journaux de Vercel | Les messages de la Taverne sont supprimés après 30 jours, même sans visite du joueur | Conforme |
| R7 | La présence ne constitue aucun historique des visites | Test « considère comme parti un joueur sans signal depuis deux minutes, et supprime sa ligne » | La présence ne constitue un historique des visites | Conforme |
| R8 | Les sessions expirées ne sont pas conservées indéfiniment | Requête SQL sur `identity.session` : sessions dont `expires_at` est passé | Les sessions expirées ne sont pas conservées indéfiniment | Conforme |
| R9 | Les journaux techniques ne contiennent pas de données personnelles au-delà du nécessaire | Lecture de `app.onError` dans `create-api.ts` ; consultation des journaux de Vercel | La fonction app.onError de create-api.ts journalise l’erreur complète. Une erreur SQL peut donc exposer des données personnelles, notamment le contenu d’un message | Non conforme |
| R10 | Après la suppression d'un compte, l'identifiant conservé ne peut plus être relié à une personne | Recherche de l'identifiant dans `identity`, `platform.outbox` et les journaux de Vercel | Les URL des flux SSE contiennent l’identifiant du joueur et les journaux de Vercel peuvent aussi contenir son adresse IP. Ces éléments peuvent permettre de relier un identifiant à une personne après la suppression du compte | Risque accepté |

## Synthèse

8 exigences conformes, 1 non conforme et 1 en risque accepté ; Corriger la R9 et se renseigner d'avantage pour R10