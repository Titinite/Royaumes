# Revue de sécurité des Quêtes : intégrité des récompenses

- Date : 2026-10-23
- Périmètre : API du module Quêtes (`/api/quests`), projection `quests`, réclamation et message
  `realm.deposit`, tâche quotidienne, contributeur de données personnelles, lecture du badge par la Taverne.
- Références : OWASP Top 10 (A01 Broken Access Control, A04 Insecure Design,
  A08 Software and Data Integrity Failures), RGPD (minimisation, limitation de la conservation).

| N° | Exigence | Vérification | Constat | Statut |
| --- | --- | --- | --- | --- |
| Q1 | Toutes les routes du module sont réservées aux joueurs connectés | Test « refuse toutes les routes à une requête anonyme (401) » (`quests-api.test.ts`) ; `create-api.ts` protège `/quests` et `/quests/*` | Les trois routes renvoient 401 sans session. `/quests` est protégé séparément, car `/quests/*` ne couvre pas `GET /api/quests` | Conforme |
| Q2 | Un joueur ne consulte et ne réclame que ses propres quêtes | Lecture de `api.ts` : aucune route n'accepte d'identifiant de joueur ; test « présente les quatre quêtes du jour du joueur connecté… » | Le joueur est toujours `c.var.userId`. Un autre joueur ne voit pas la progression du premier | Conforme |
| Q3 | Le paramètre de la réclamation est validé avant tout traitement | Test « refuse un rang de quête invalide (400) » : `4`, `-1`, `abc`, `1.5` | `ClaimParams` impose un entier de 0 à 3 ; toute autre valeur produit 400 `INVALID_INPUT` | Conforme |
| Q4 | Une récompense n'est versée qu'une fois, y compris lors de réclamations simultanées | Tests « n'accepte qu'une réclamation parmi deux réclamations simultanées » (service) et « verse la récompense au village du joueur, une seule fois » (API) | La clé primaire de `quests.claims` départage les réclamations ; la seconde ne produit aucun message, et le stock du village ne change qu'une fois | Conforme |
| Q5 | Une récompense ne peut être réclamée que pour une quête terminée du jour, par un joueur qui a un village | Tests des règles 6 et 8 (`daily.test.ts`, `quests-service.test.ts`) ; test API « refuse la réclamation d'une quête non terminée (409) » | `checkClaim` est appliqué avant toute écriture, sur le tableau du jour recalculé côté serveur | Conforme |
| Q6 | Le joueur ne peut pas falsifier sa progression | Lecture de `api.ts` : aucune route n'écrit dans `counters` ; `git grep -n "insert(counters" -- src` | La progression n'est écrite que par la projection, à partir des événements du journal, eux-mêmes produits par les commandes contrôlées des autres modules | Conforme |
| Q7 | Le montant de la récompense est fixé par le serveur, jamais par le client | Lecture de `quests-service.ts` : seul le rang est reçu ; la récompense vient de `QUESTS` (catalogue du domaine) | Le client ne transmet aucune quantité ; le Village valide en plus le message par `TransferRequest` (`ResourceAmounts`) | Conforme |
| Q8 | Un message de versement remis plusieurs fois n'a d'effet qu'une fois | Test « identifie le versement par le joueur, le jour et la quête… » ; test existant du Village sur les doublons (`messages.test.ts`) | Le `transferId` est déterministe ; le gestionnaire du Village ignore un transfert déjà connu | Conforme |
| Q9 | Une reconstruction de la projection ne permet pas de réclamer une seconde fois | Test « reconstruit les métriques sans effacer les récompenses réclamées » | `reset` ne vide pas `quests.claims` | Conforme |
| Q10 | La liste des champions n'expose aucune donnée superflue | Appel de `GET /api/quests/champions` | La réponse ne contient que des identifiants de joueurs, sans progression ni nom. Ces identifiants sont déjà visibles par tous dans les messages de la Taverne (`authorId`) | Risque accepté |
| Q11 | Les données personnelles du module sont exportées, effacées et limitées à sept jours | Tests « inclut les quêtes dans l'export, et les efface avec le compte » et « supprime les données de plus de sept jours… » ; `personal-data.test.ts` | Les cinq tables du schéma sont couvertes par l'effacement. La purge quotidienne supprime progression et réclamations de plus de 7 jours | Conforme |
| Q12 | La tâche quotidienne n'est déclenchable qu'avec le secret | Test existant « refuse une requête sans le secret attendu… » (`cron-api.test.ts`) ; test de la purge, avec le secret | La purge des Quêtes est exécutée par la route `/api/cron/daily`, déjà protégée par `CRON_SECRET` | Conforme |
| Q13 | Une lecture ne peut pas épuiser le serveur | Lecture de `champions()` : calcul pour tous les joueurs actifs du jour | Le coût croît avec le nombre de joueurs actifs du jour (DT-012). Il reste faible pour le nombre de joueurs du projet | Risque accepté |

## Synthèse

13 exigences : 11 conformes, 0 non conforme, 2 en risque accepté (Q10, Q13).

Actions décidées :
- Q13 : enregistrer le badge dans la projection lorsqu'il est obtenu, au lieu de le recalculer
  à chaque lecture (DT-012), si le nombre de joueurs actifs augmente ; mesurer `GET /api/quests/champions`
  par le test de charge avant toute ouverture plus large.
- Q10 : aucune action ; à réexaminer si les identifiants des joueurs cessent d'être exposés par la Taverne.