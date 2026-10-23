# Bilan technique de Royaumes

- Date : 2026-10-23
- Version examinée : étiquette `eval-fin` (comparée à `td11-fin`)
- Auteur : Thibault LERAY

Ce bilan dresse l'état technique du projet au terme de son développement, à partir de ses
décisions d'architecture, de ses indicateurs de qualité, de sa dette technique et de ses
revues. Il s'adresse à la personne qui reprendrait le projet.

## 1. Le système livré

| Élément | Valeur |
| --- | --- |
| Modules métier | 7 |
| Briques de la plateforme | 9 |
| Lignes de code, hors tests | 8741 |
| Fichiers de test, nombre de tests | 38, 278 |
| Commits | 100 |
| Hébergement | Vercel (Francfort), base Neon (Francfort) |

| Module | Stockage | Lignes, hors tests |
| --- | --- | --- |
| `realm` | Event Sourcing | 937 |
| `dungeon` | Event Sourcing, projection des expéditions ouvertes | 2064 |
| `market` | Event Sourcing, projection des offres, saga | 1271 |
| `ranking` | Projection du journal | 459 |
| `tavern` | Tables ordinaires | 678 |
| `quests` | Tables ordinaires tenues par une projection du journal, boîte d'envoi | 918 |
| `system` | Aucun | 73 |

## 2. Les décisions d'architecture

| ADR | Décision | Mise à l'épreuve | Bilan |
| --- | --- | --- | --- |
| 01 | Monolithe modulaire | Extraction du Village (TD11) | Les frontières entre modules peuvent être testées. L’extraction reste possible, mais ajoute un second mode d’exécution à maintenir. |
| 02 | Event Sourcing pour le Village | Ajout de projections pour répondre aux besoins de lecture | Le journal permet de reconstruire l’état et de créer des vues adaptées. En contrepartie, il grandit et rend certaines opérations plus coûteuses. |
| 03 | Server-Sent Events alimentés par le journal | Mise en place du flux temps réel pour diffuser les événements aux clients | Le mécanisme évite les rechargements de page et réutilise le journal. La charge augmente toutefois avec le nombre de connexions. |
| 04 | Manches simultanées et échéances paresseuses | Gestion des joueurs inactifs et des échéances de combat | Le système évite qu’une manche reste bloquée indéfiniment. Il faut néanmoins garantir la cohérence des échéances et gérer les actions tardives. |
| 05 | Intelligence artificielle déterministe | Exécution répétée des combats et tests des comportements de l’IA | Le déterminisme facilite la reproduction des combats et le débogage. Il limite toutefois la variabilité des comportements. |
| 06 | CQRS et projections rattrapées à la lecture | Mesures de performance de la partie 3 et rattrapage des projections | Les projections accélèrent les lectures, mais introduisent une cohérence différée et un coût de reconstruction |
| 07 | Saga orchestrée et boîte d'envoi | Simulation d’une panne partielle et reprise des opérations à la partie 4 | La boîte d’envoi permet de fiabiliser la publication des événements et la saga de coordonner plusieurs opérations. Il faut gérer les reprises et l’idempotence |
| 08 | Taverne sans Event Sourcing, réécriture ciblée du journal | Mise en place de la conservation limitée des messages et de l’effacement des données | Les tables ordinaires simplifient la gestion des messages. La réécriture du journal reste une opération délicate, notamment pour l’effacement |
| 09 | Extraction du Village, préparée mais non déployée | Exécution du Village dans un service autonome, avec sa propre base et ses tests de contrat | Les frontières sont éprouvées sans déploiement en production. En contrepartie, deux modes d’exécution, une synchronisation différée des événements et des dettes techniques doivent être maintenus |
| 10 | Quêtes : tables classiques tenues par une projection, tirage déterministe | Reconstruction de la projection, purge quotidienne, réclamations simultanées | Aucune écriture pour attribuer les quêtes, et une conservation limitée simple à appliquer. La reconstruction ne doit jamais vider les réclamations, ce qu'un test protège |
| 11 | Quêtes : lecture du langage publié, versement par la boîte d'envoi | Versement effectif au Village dans les tests d'API, doublons ignorés | Aucun module existant n'a été modifié côté serveur. La projection dépend de la forme des événements des autres modules, et `enqueue` étend la plateforme |

## 3. La qualité

| Caractéristique | Indicateur | Valeur | Appréciation |
| --- | --- | --- | --- |
| Adéquation fonctionnelle | Tests réussis ; couverture des domaines | 278 tests (232 à `td11-fin`), 75,83 % de couverture des lignes (75 % à `td11-fin`) ; domaine et application des Quêtes couverts à 100 % | Chaque règle de la fiche de cadrage des Quêtes est vérifiée par un test. L'écran des Quêtes, comme les autres écrans, n'est pas testé automatiquement |
| Efficacité des performances | Débit et p99 des lectures ; respect du budget | débit compris entre 91 et 226 requêtes/s, latence p50 entre 73 et 224 ms, latence p99 entre 230 et 481 ms, aucune erreur observée | la Taverne présente le meilleur débit et les latences les plus faibles. Le Marché présente le débit le plus faible et une latence p50 plus élevée. Aucun échec n’a été observé pendant les tests, mais ces résultats ne garantissent pas les mêmes performances en production |
| Fiabilité | Tests de concurrence, de reprise et d'idempotence ; messages abandonnés | 0 | La boîte d’envoi et la saga prévoient des mécanismes de reprise. Leur fiabilité dépend des tests de panne, de la gestion des doublons et du suivi des messages en échec |
| Sécurité | Exigences des revues de sécurité | À reprendre des comptes rendus | Les contrôles permettent d’identifier les faiblesses. Les actions non résolues doivent rester suivies dans la dette technique |
| Maintenabilité | Règles d'architecture ; fonctions d'aptitude ; couverture | 0 violation (comme à `td11-fin`) ; 2 fonctions d'aptitude respectées sans modification ; 75,83 % de couverture des lignes | Le module Quêtes respecte les frontières : il n'utilise les autres modules que par leurs contrats et leur `ui.tsx`. L'interface reste sans tests automatiques |
| Flexibilité | Extraction d'un module ; changement de base entre local et production | Extraction du Village préparée, mais non déployée | L’extraction permet de tester les frontières entre modules. Le service autonome nécessite encore des corrections avant son éventuel déploiement |

## 4. La dette technique

| Indicateur | Valeur |
| --- | --- |
| Entrées consignées | 13 |
| Entrées remboursées, dont à l'échéance prévue | 7, dont 7 remboursées à l'échéance indiquée |
| Entrées ouvertes | 6 |

Analyse :
Le registre recense 13 entrées de dette technique. 7 sont remboursées.

Le module Quêtes ajoute trois dettes ouvertes, signalées dans le code par `DETTE TECHNIQUE` :
DT-011 (changement de jour à minuit UTC), DT-012 (badge recalculé pour tous les joueurs actifs)
et DT-013 (participants des expéditions abandonnées conservés). Aucune n'affecte l'intégrité des
récompenses ; DT-012 est la première à traiter si l'activité augmente.

## 5. Les revues

| Revue | Exigences | Conformes | Non conformes ou en risque accepté | Actions ouvertes |
| --- | --- | --- | --- | --- |
| Sécurité de l'authentification | 16 renseignées, 1 statut manquant | 11 explicitement conformes | 3 non conformes (S4, S5, S7), 1 risque accepté (S9) | Vérifier HttpOnly et SameSite, corriger S7, compléter S11 |
| Sécurité du Donjon | 14 | 12 | 2 risques acceptés (D10, D14) | Aucun défaut explicitement déclaré non conforme dans la revue |
| Sécurité du Marché | 10 | 10 | 0 | Aucune action corrective explicitement identifiée dans la revue |
| Conformité au RGPD | 10 | 8 | 1 non-conformité (R9), 1 risque accepté (R10) | Corriger la journalisation et réévaluer le risque de réidentification |
| Sécurité des Quêtes | 13 | 11 | 2 risques acceptés (Q10, Q13) | Enregistrer le badge à son obtention si l'activité augmente (DT-012) |

## 6. Risques et recommandations

| N° | Risque | Signe avant-coureur | Recommandation |
| --- | --- | --- | --- |
| 1 | Exposition de données personnelles dans les journaux techniques (R9) | Une erreur SQL peut révéler le contenu d’un message | Journaliser uniquement les informations nécessaires, expurger les données personnelles et vérifier les journaux après correction |
| 2 | Réidentification possible après la suppression d’un compte (R10) | Identifiant du joueur dans les URL SSE et adresse IP potentiellement conservée dans les journaux Vercel | Réduire les identifiants présents dans les URL et les journaux, examiner les durées de conservation et réévaluer le risque après suppression du compte |
| 3 | Limitation des tentatives et échanges bloqués (DT-004, DT-007) | Compteurs d’authentification distincts selon les instances ; messages abandonnés nécessitant une intervention SQL | Utiliser une limitation partagée entre instances et mettre en place une détection, une supervision et une procédure de reprise des messages abandonnés |
| 4 | Évolution d'un événement lu par les Quêtes (DT-011 à DT-013, ADR 11) | Un champ renommé dans un événement du Village, du Donjon ou du Marché | Faire passer toute modification d'un événement publié par une revue, et conserver les tests de la projection des Quêtes, qui échouent dans ce cas |

## 7. Conclusion

Le projet peut être repris et continuer à évoluer grâce à son architecture modulaire, à ses tests automatisés et à la documentation des décisions techniques. 
Toutefois, l’absence de régression ne peut pas être garantie en l’état : plusieurs points de sécurité restent à corriger, notamment la configuration de l’authentification et la journalisation des données personnelles.

Pour assurer une évolution fiable, il faut corriger ces points, stabiliser les tests, compléter les revues et maintenir à jour le registre de dette technique. La reprise est donc possible, à condition de traiter les risques identifiés et de vérifier chaque évolution par des tests automatisés et des revues régulières.

## Usage de l'IA générative

Utilisation de Claude pour lister les éléments à inclure dans les différentes parties. Rédaction manuelle.