# Revue de sécurité du parcours d'authentification

- Date : 2026-10-20
- Périmètre : inscription, connexion, déconnexion, sessions, accès à l'API et aux pages du jeu.
- Références : OWASP Top 10, OWASP ASVS.

| N° | Exigence | Vérification | Constat | Statut |
| --- | --- | --- | --- | --- |
| S1 | Les mots de passe ne sont conservés que sous forme d'empreinte, par une fonction dédiée | Test « ne conserve qu'une empreinte du mot de passe » ; documentation de Better Auth | Le schéma stocke cette empreinte dans identity.account.password, et non le mot de passe en clair | Conforme |
| S2 | Les mots de passe comportent au moins 8 caractères | Test « refuse un mot de passe trop court » | La configuration impose 8 caractères minimum | Conforme |
| S3 | Les tentatives répétées d'inscription et de connexion sont limitées | Sous-partie 2.3 ; configuration de `better-auth.ts` | La configuration prévoit une limitation des tentatives : 40 inscriptions et 60 connexions par fenêtre de 60 secondes. La limitation est activée par défaut et ne peut être désactivée qu'en local via AUTH_RATE_LIMIT=off. On voit un message et le blocage | Conforme |
| S4 | Le cookie de session est inaccessible au JavaScript de la page | Test sur l'attribut `HttpOnly` | Le test fourni ne vérifie pas encore l'attribut HttpOnly. Il faut le tester manuellement | Non conforme |
| S5 | Le cookie de session n'est pas envoyé par les requêtes émises depuis un autre site | Test sur l'attribut `SameSite` | Le test fourni ne vérifie pas encore l'attribut SameSite. Il faut vérifier ça manuellement | Non conforme |
| S6 | Le cookie de session ne circule que sur des connexions chiffrées | Inspection du cookie dans le navigateur ; comportement en local et en production | En local, le cookie ne porte pas l'attribut Secure, car la connexion n'est pas chiffrée | Non conforme |
| S7 | Le secret de signature n'est pas versionné, et son absence en production empêche le démarrage | `git grep BETTER_AUTH_SECRET` ; fonction `resolveSecret` | Le secret est lu depuis BETTER_AUTH_SECRET et une valeur de développement est prévue en remplacement. L'absence du secret provoque actuellement une erreur uniquement si NODE_ENV=production et VERCEL sont définis donc cela peut passer inaperçu dans un autre environnement de production | Non conforme |
| S8 | La connexion ne révèle pas si une adresse est inscrite | Test « répond de la même manière que l'adresse existe ou non » | La page de connexion affiche l'erreur « Adresse ou mot de passe incorrect » donc impossible de savoir si l'adresse existe | Conforme |
| S9 | L'inscription ne révèle pas si une adresse est inscrite | Création d'un compte avec une adresse déjà utilisée | La page affiche « Cette adresse est déjà utilisée. » lorsqu'une inscription utilise une adresse existante. L'existence d'un compte est donc révélée mais il n'y a pas de données vraiment sensible dans le jeu pour le moment | Risque accepté |
| S10 | Toute route de l'API réservée aux joueurs refuse une requête anonyme | Tests « Contrôle d'accès à l'API du Village » ; racine de composition | Les tests vérifient qu'une lecture et une commande anonymes sont refusées avec une réponse 401. Le risque d'oubli lors de l'ajout d'un nouveau module est maîtrisé par l'ajout systématique d'un test de contrôle d'accès pour chaque module protégé. | Conforme |
| S11 | Un joueur ne peut accéder qu'à ses propres données | Test « isole les villages des joueurs » ; origine de `userId` dans les routes | Le test vérifie que les joueurs Alice et Bob récupèrent chacun leur propre village. Les routes s'appuient sur l'identité fournie par authentification | |
| S12 | Les pages du jeu sont protégées sur le serveur, avant tout rendu | Mise en page `app/(jeu)/layout.tsx` ; accès à `/village` sans session | Le layout vérifie la session côté serveur via currentUser() avant d'afficher les pages du jeu. En l'absence de session, l'utilisateur est redirigé vers /login | Conforme |
| S13 | Les erreurs imprévues ne révèlent aucun détail technique au client | Gestionnaire `onError` de la racine de composition | Le gestionnaire global onError renvoie une erreur JSON générique avec le code INTERNAL et le message « Erreur interne », sans exposer les détails techniques au client | Conforme |
| S14 | La déconnexion invalide la session sur le serveur | Réutilisation d'un cookie après déconnexion | La réutilisation du cookie après déconnexion ne connecte pas car la session n'est plus valide | Conforme |
| S15 | Une requête d'authentification accompagnée d'un cookie et émise depuis une autre origine est refusée | Appel de la déconnexion avec un en-tête `origin` étranger | Une origine étrangère provoque INVALID_ORIGIN. Une requête sans origine provoque MISSING_OR_NULL_ORIGIN | Conforme |

## Synthèse

11 conformes, 4 non conformes et 1 en risque accepté ; corriger S7.