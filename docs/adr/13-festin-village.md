# ADR-13 - Festin du Village : effet temporaire calculé par le domaine, à partir d'un seul événement

- Statut : accepté
- Date : 2026-10-27

## Contexte

Le blé est produit par le moulin depuis le TD3, mais aucune règle ne permet de le dépenser : il
s'accumule sans servir à rien. Le Festin lui donne un usage : le joueur dépense une grande quantité
de blé pour augmenter toute la production de son village pendant une durée limitée.

Cette évolution touche le Village, dont l'état est reconstruit à partir de ses événements (ADR 02),
et dont la production est calculée de manière paresseuse : le stock n'est mis à jour qu'à
l'instant d'une commande ou d'une lecture, en multipliant les taux par le temps écoulé. Un effet
temporaire peut donc se terminer au milieu d'un intervalle de calcul, sans qu'aucune requête n'ait
lieu à cet instant.

Le Village doit aussi rester extractible dans son service (ADR 09) : une nouvelle route doit
fonctionner dans les deux modes d'exécution. Enfin, plusieurs modules lisent ses événements
(Classement, Quêtes, Hauts faits) : une évolution ne doit pas les obliger à changer.

L'évolution ne fait partie d'aucun des deux modules de l'évaluation : elle est présentée à part
dans le document de rendu.

## Décision

- **Règle** : un festin coûte 300 blés et augmente de 25 % la production de toutes les ressources
  pendant 5 minutes. Un seul festin peut être en cours : il n'est ni cumulable, ni prolongeable
  (erreur `FEAST_IN_PROGRESS`, HTTP 409). Le coût élevé et cette règle empêchent de l'enchaîner.
  Les trois valeurs sont rangées dans le catalogue du domaine (`FEAST`, `domain/catalog.ts`).
- **Un seul événement, `FeastHeld`**, qui porte le coût payé, l'augmentation et l'instant de fin
  (`until`), comme `BuildingUpgraded` porte son coût (ADR 02). Changer l'équilibrage plus tard ne
  modifiera pas les festins passés lorsqu'ils seront rejoués.
- **Aucun événement de fin** : la fin du festin est une échéance, calculée par le domaine, comme les
  échéances du Donjon (ADR 04). La fonction pure `produce(stock, taux, de, à, festin)` découpe
  l'intervalle de calcul à l'instant `until` : seule la partie couverte par le festin est
  augmentée. Elle est utilisée par `accrue` sur le serveur et par `stockAt` dans l'interface, qui
  extrapolent donc le même stock.
- **Commande `HoldFeast` sans contenu**, exposée par `POST /api/realm/village/feast`, sans corps :
  le joueur ne choisit ni le coût, ni l'effet. Il n'y a donc aucune entrée à valider. La route
  hérite du contrôle d'accès de `/api/realm/*` (`requireUser`).
- **Concurrence** : deux demandes simultanées sont traitées par la concurrence optimiste existante
  (`withOptimisticRetry`) ; la seconde est rejouée sur l'état à jour et refusée, et le blé n'est
  dépensé qu'une fois.
- **Évolution additive** : l'état reçoit un champ `feast`, nul dans l'état initial. Les flux existants
  se rejouent donc sans migration. Le Classement, les Quêtes et les Hauts faits ne lisent que les types
  d'événements qu'ils déclarent (`eventTypes`) : ils ignorent `FeastHeld` sans modification.
- `FeastHeld` ne contient aucune donnée personnelle : la réécriture du journal lors d'un effacement
  (ADR 08) et le registre des traitements restent inchangés.

## Conséquences

### Positives

- Le blé a enfin un usage, sans nouvelle ressource ni nouveau module.
- La règle temporelle est entièrement dans le domaine pur, et testée sans base ni horloge réelle,
  y compris la fin d'un festin au milieu d'un intervalle et une amélioration faite pendant un festin.
- Aucune tâche planifiée ni écriture n'est nécessaire à la fin d'un festin.
- Le serveur et l'interface utilisent la même fonction de calcul : ils ne peuvent pas diverger.
- La route fonctionne sans modification dans le service Village extrait : un test d'API la vérifie
  dans les deux modes d'exécution.
- Aucun autre module n'a été modifié : les frontières de l'ADR 01 sont respectées.

### Négatives

- La fin d'un festin n'apparaît pas dans le journal : un module qui voudrait réagir à cette fin
  devrait la recalculer à partir de `until`.
- L'intérêt du festin dépend du développement du village : au début du jeu, 300 blés rapportent
  à peine une vingtaine de ressources en 5 minutes, alors qu'un village très développé produit ce
  blé bien plus vite et tire un gain bien plus grand du même bonus.
- La vue du Village s'enrichit d'un champ (`feast`) : un client plus ancien qui l'ignorerait
  afficherait un stock légèrement sous-estimé pendant un festin, jusqu'à la lecture suivante.

## Alternatives écartées

- **Deux événements, `FeastStarted` et `FeastEnded`** : la fin devrait être enregistrée par une tâche
  planifiée ou par la commande suivante. Le stock entre la fin réelle et cet enregistrement serait
  faux, ou il faudrait de toute façon recalculer la fin, comme le fait la décision retenue.
- **Augmenter les taux de production dans l'état** pendant le festin : le retour aux taux normaux
  demande, lui aussi, une écriture à l'instant de la fin.
- **Conversion immédiate du blé en or** : plus simple, mais sans intérêt de jeu, et sans règle
  temporelle à concevoir.
- **Points de renommée repris par le Classement** : obligeait à modifier la projection du Classement,
  donc un second module, pour une évolution qui ne concerne que le Village.
- **Coût croissant avec le nombre de festins** : plus équilibré à long terme, mais la règle « un seul
  festin à la fois » suffit à empêcher l'enchaînement pour le nombre de joueurs du projet.

## Réexamen

Revoir cette décision si le festin est délaissé par les joueurs débutants, ou s'il devient un
bonus quasi permanent pour les joueurs avancés (coût à indexer sur la production du moulin).
La revoir aussi si un autre module doit réagir à la fin d'un festin : un événement de fin,
enregistré par la tâche quotidienne, deviendrait alors nécessaire.

## Usage de l'IA générative

Protoypage et idéation réalisés seul puis utilisation de Claude pour générer un code plus propre, commenté et rédiger la documentation.