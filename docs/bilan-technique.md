# Bilan technique de Royaumes

- Date : 2026-10-21
- Version examinée : étiquette `td11-fin`
- Auteur : Thibault LERAY

Ce bilan dresse l'état technique du projet au terme de son développement, à partir de ses
décisions d'architecture, de ses indicateurs de qualité, de sa dette technique et de ses
revues. Il s'adresse à la personne qui reprendrait le projet.

## 1. Le système livré

| Élément | Valeur |
| --- | --- |
| Modules métier | 6 |
| Briques de la plateforme | 9 |
| Lignes de code, hors tests | 7747 |
| Fichiers de test, nombre de tests | 31, 232 |
| Commits | 82 |
| Hébergement | Vercel (Francfort), base Neon (Francfort) |

| Module | Stockage | Lignes, hors tests |
| --- | --- | --- |
| `realm` | Event Sourcing | 937 |
| `dungeon` | Event Sourcing, projection des expéditions ouvertes | 2064 |
| `market` | Event Sourcing, projection des offres, saga | 1271 |
| `ranking` | Projection du journal | 459 |
| `tavern` | Tables ordinaires | 678 |
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

## 3. La qualité

| Caractéristique | Indicateur | Valeur | Appréciation |
| --- | --- | --- | --- |
| Adéquation fonctionnelle | Tests réussis ; couverture des domaines | 232 tests et 75 % de couverture des lignes | La suite de tests vérifie les principaux comportements métier. La couverture ne garantit toutefois pas l’absence de régressions |
| Efficacité des performances | Débit et p99 des lectures ; respect du budget | débit compris entre 91 et 226 requêtes/s, latence p50 entre 73 et 224 ms, latence p99 entre 230 et 481 ms, aucune erreur observée | la Taverne présente le meilleur débit et les latences les plus faibles. Le Marché présente le débit le plus faible et une latence p50 plus élevée. Aucun échec n’a été observé pendant les tests, mais ces résultats ne garantissent pas les mêmes performances en production |
| Fiabilité | Tests de concurrence, de reprise et d'idempotence ; messages abandonnés | 0 | La boîte d’envoi et la saga prévoient des mécanismes de reprise. Leur fiabilité dépend des tests de panne, de la gestion des doublons et du suivi des messages en échec |
| Sécurité | Exigences des revues de sécurité | À reprendre des comptes rendus | Les contrôles permettent d’identifier les faiblesses. Les actions non résolues doivent rester suivies dans la dette technique |
| Maintenabilité | Règles d'architecture ; fonctions d'aptitude ; couverture | 75 % de couverture des lignes | Les modules séparés et les tests facilitent la maintenance. Cependant, l’interface ne dispose pas de tests automatiques suffisants pour prévenir les régressions visuelles et fonctionnelles |
| Flexibilité | Extraction d'un module ; changement de base entre local et production | Extraction du Village préparée, mais non déployée | L’extraction permet de tester les frontières entre modules. Le service autonome nécessite encore des corrections avant son éventuel déploiement |

## 4. La dette technique

| Indicateur | Valeur |
| --- | --- |
| Entrées consignées | 10 |
| Entrées remboursées, dont à l'échéance prévue | 7, dont 7 remboursées à l’échéance indiquée |
| Entrées ouvertes | 3 |

Analyse :
Le registre recense 7 entrées de dette technique. 5 sont remboursées : DT-001 (identité du joueur), DT-002 (stockage des événements du Village), DT-003 (concurrence optimiste), DT-005 (consultation des expéditions ouvertes) et DT-006 (échéance d’exploration du Donjon).

Deux dettes restent ouvertes et sont prévues pour TD11 :
- DT-004 : Limitation des tentatives d’authentification en mémoire. Les compteurs sont propres à chaque instance. Avec plusieurs instances actives, la limite effective peut donc être multipliée par leur nombre.
- DT-007 : Gestion des messages abandonnés. Les messages en lettres mortes sont uniquement comptés par la tâche quotidienne. Une saga interrompue peut nécessiter une intervention SQL pour être détectée et relancée, notamment lorsqu’une offre reste bloquée avec des ressources en séquestre.

La priorité est de traiter ces deux dettes afin de renforcer la sécurité de l’authentification et la capacité de reprise des échanges du Marché. Le suivi doit conserver les échéances et les preuves de remboursement dans le registre.

## 5. Les revues

| Revue | Exigences | Conformes | Non conformes ou en risque accepté | Actions ouvertes |
| --- | --- | --- | --- | --- |
| Sécurité de l'authentification | 16 renseignées, 1 statut manquant | 11 explicitement conformes | 3 non conformes (S4, S5, S7), 1 risque accepté (S9) | Vérifier HttpOnly et SameSite, corriger S7, compléter S11 |
| Sécurité du Donjon | 14 | 12 | 2 risques acceptés (D10, D14) | Aucun défaut explicitement déclaré non conforme dans la revue |
| Sécurité du Marché | 10 | 10 | 0 | Aucune action corrective explicitement identifiée dans la revue |
| Conformité au RGPD | 10 | 8 | 1 non-conformité (R9), 1 risque accepté (R10) | Corriger la journalisation et réévaluer le risque de réidentification |

## 6. Risques et recommandations

| N° | Risque | Signe avant-coureur | Recommandation |
| --- | --- | --- | --- |
| 1 | Exposition de données personnelles dans les journaux techniques (R9) | Une erreur SQL peut révéler le contenu d’un message | Journaliser uniquement les informations nécessaires, expurger les données personnelles et vérifier les journaux après correction |
| 2 | Réidentification possible après la suppression d’un compte (R10) | Identifiant du joueur dans les URL SSE et adresse IP potentiellement conservée dans les journaux Vercel | Réduire les identifiants présents dans les URL et les journaux, examiner les durées de conservation et réévaluer le risque après suppression du compte |
| 3 | Limitation des tentatives et échanges bloqués (DT-004, DT-007) | Compteurs d’authentification distincts selon les instances ; messages abandonnés nécessitant une intervention SQL | Utiliser une limitation partagée entre instances et mettre en place une détection, une supervision et une procédure de reprise des messages abandonnés |

## 7. Conclusion

Le projet peut être repris et continuer à évoluer grâce à son architecture modulaire, à ses tests automatisés et à la documentation des décisions techniques. 
Toutefois, l’absence de régression ne peut pas être garantie en l’état : plusieurs points de sécurité restent à corriger, notamment la configuration de l’authentification et la journalisation des données personnelles.

Pour assurer une évolution fiable, il faut corriger ces points, stabiliser les tests, compléter les revues et maintenir à jour le registre de dette technique. La reprise est donc possible, à condition de traiter les risques identifiés et de vérifier chaque évolution par des tests automatisés et des revues régulières.

## Usage de l'IA générative

Utilisation de Claude pour lister les éléments à inclure dans les différentes parties. Rédaction manuelle.