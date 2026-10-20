# Revue de sécurité du Donjon : dissimulation d'informations et intégrité du jeu

- Date : 2026-10-20
- Périmètre : API du module Donjon, canal temps réel des expéditions, tirages au sort.
- Références : OWASP Top 10 (A01 Broken Access Control, A04 Insecure Design).

| N° | Exigence | Vérification | Constat | Statut |
| --- | --- | --- | --- | --- |
| D1 | La vue d'une expédition ne contient ni la graine ni le contenu des salles non explorées | Test « ne transmet ni la graine ni le contenu des salles suivantes » | La vue est construite explicitement sans la graine ni la liste complète des salles. Seule la salle courante est transmise | Conforme |
| D2 | L'action choisie par un héros n'est connue que de son joueur jusqu'à la résolution de la manche | Tests « cache l'action choisie par les autres héros » et « ne révèle pas l'action d'un héros aux autres joueurs » ; outils de développement | L'action n'est transmise qu'au joueur qui incarne le héros et les autres joueurs reçoivent action: null, tout en pouvant voir si le coéquipier est prêt | Conforme |
| D3 | Le canal d'une expédition n'est accessible qu'à ses membres | Test « réserve le canal d'une expédition à ses membres (403) » | L'accès au canal est accordé uniquement si service.getView() indique que le joueur est membre, sinon, la politique refuse l'accès ; stream-api.ts renvoie une erreur HTTP 403 | Conforme |
| D4 | Le canal d'une expédition ne transmet aucune donnée d'événement, ni par le flux, ni par la route de repli | Tests du bloc « Canal discret » et « signale l'action d'un héros sans la révéler » | Les données d'un événement sont remplacées par un objet vide lorsque le canal est discret. Cette fonction est utilisée pour le flux SSE comme pour la route de repli /events | Conforme |
| D5 | Un joueur ne peut agir qu'en son propre nom | Lecture de `api.ts` : aucune route n'accepte d'identifiant de joueur | Les routes de création, de participation, de lancement, d'ouverture de porte et d'action utilisent c.var.userId, issu de l'authentification | Conforme |
| D6 | Seul l'hôte lance l'expédition, et seul le héros dont c'est le tour ouvre une porte | Tests « ne laisse que l'hôte lancer l'expédition » et « fait ouvrir les portes à tour de rôle » | Le code de l'API transmet l'identité authentifiée au domaine, où les règles contrôlent les commandes | Conforme |
| D7 | Un joueur ne peut ni choisir ni prévoir le résultat d'un tirage au sort | Lecture de `dungeon-service.ts` : graine tirée par le serveur ; exigence D1 | La graine est générée par le serveur et n'est pas transmise dans la vue | Conforme |
| D8 | L'échéance d'une manche est appréciée par l'horloge du serveur | Commande d'échéance envoyée avant l'échéance | Le serveur utilise sa propre horloge pour vérifier l'échéance d'une manche | Conforme |
| D9 | Une action destinée à une manche déjà résolue est refusée | Test « refuse un choix pour une manche déjà résolue » | La logique métier contrôle le numéro de manche et refuse les choix devenus obsolètes | Conforme |
| D10 | Connaître l'adresse d'une expédition ne permet pas d'y agir sans en être membre | Action envoyée par un joueur qui n'est pas membre | Un joueur non membre ne peut pas agir sur l'expédition (erreur NOT_A_MEMBER, HTTP 403). Il peut toutefois consulter la vue s'il connaît son adresse : ce risque est accepté car seules des informations publiques sont exposées et l'identifiant est un UUID aléatoire | Risque accepté |

## Synthèse

9 exigences conformes, 0 non conforme et 1 en risque accepté ; actions décidées : conserver la consultation d'une expédition par son adresse, en acceptant le risque puisque seules des informations publiques sont accessibles